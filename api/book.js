import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // CORS headers — allow your frontend domain in production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      fname, lname, email, phone,
      firstTattoo, placement, placementNote,
      description, size,
      budget, date1, date2, timeOfDay,
      fileNames   // array of filenames (actual files handled separately via Supabase Storage)
    } = req.body;

    // ── 1. Save to Supabase ──────────────────────────────────────
    const { data, error: dbError } = await supabase
      .from('bookings')
      .insert([{
        first_name:      fname,
        last_name:       lname,
        email,
        phone:           phone || null,
        first_tattoo:    firstTattoo === true || firstTattoo === 'true',
        placement:       Array.isArray(placement) ? placement : [placement],
        placement_note:  placementNote || null,
        description,
        size:            size || null,
        budget:          parseInt(budget) || null,
        preferred_date1: date1 || null,
        preferred_date2: date2 || null,
        time_of_day:     timeOfDay || null,
        file_names:      fileNames || [],
        status:          'new'
      }])
      .select()
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    // ── 2. Email the artist (you) ────────────────────────────────
    await resend.emails.send({
      from:    'Inkwell Bookings <bookings@yourdomain.com>',  // ← update this
      to:      process.env.ARTIST_EMAIL,
      subject: `New Booking Request — ${fname} ${lname}`,
      html: artistEmailHTML({ fname, lname, email, phone, firstTattoo, placement, placementNote, description, size, budget, date1, date2, timeOfDay, fileNames, id: data.id })
    });

    // ── 3. Confirmation email to the client ─────────────────────
    await resend.emails.send({
      from:    'Inkwell Studio <hello@yourdomain.com>',       // ← update this
      to:      email,
      subject: `We received your request, ${fname} ✦`,
      html: clientEmailHTML({ fname })
    });

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}

// ── Email Templates ──────────────────────────────────────────────

function artistEmailHTML(b) {
  const placements = Array.isArray(b.placement) ? b.placement.join(', ') : b.placement;
  const files = b.fileNames?.length ? b.fileNames.join(', ') : 'None uploaded';
  return `
  <div style="background:#080808;color:#ccc0b4;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto;">
    <div style="border-top:2px solid #8b1a1a;padding-top:24px;margin-bottom:32px;">
      <h1 style="font-family:Georgia,serif;font-size:32px;color:#e8ddd0;letter-spacing:0.1em;margin:0 0 4px;">NEW BOOKING REQUEST</h1>
      <p style="color:#7a6a60;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;margin:0;">Ref #${b.id?.slice(0,8).toUpperCase() || 'PENDING'}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      ${row('Name', `${b.fname} ${b.lname}`)}
      ${row('Email', `<a href="mailto:${b.email}" style="color:#c0392b;">${b.email}</a>`)}
      ${row('Phone', b.phone || '—')}
      ${row('First Tattoo?', b.firstTattoo === true || b.firstTattoo === 'true' ? '✦ Yes — first timer' : 'No')}
      ${dividerRow('DESIGN')}
      ${row('Placement', placements || '—')}
      ${row('Placement Note', b.placementNote || '—')}
      ${row('Size', b.size || '—')}
      ${row('Budget', b.budget ? `$${b.budget}` : '—')}
      ${row('Description', `<em style="color:#e8ddd0;">${b.description}</em>`, true)}
      ${dividerRow('AVAILABILITY')}
      ${row('Date 1', b.date1 || '—')}
      ${row('Date 2', b.date2 || '—')}
      ${row('Time of Day', b.timeOfDay || '—')}
      ${dividerRow('FILES')}
      ${row('References', files)}
    </table>

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #2a2020;font-size:11px;color:#3d302e;letter-spacing:0.2em;text-transform:uppercase;">
      Inkwell Studio · Booking System
    </div>
  </div>`;
}

function row(label, value, tall = false) {
  return `
  <tr>
    <td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#7a6a60;vertical-align:top;white-space:nowrap;width:160px;">${label}</td>
    <td style="padding:${tall ? '10px' : '10px'} 12px;border-bottom:1px solid #1c1717;font-size:15px;color:#ccc0b4;vertical-align:top;">${value}</td>
  </tr>`;
}

function dividerRow(label) {
  return `
  <tr>
    <td colspan="2" style="padding:16px 12px 8px;font-family:monospace;font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#8b1a1a;border-bottom:1px solid #2a2020;">— ${label}</td>
  </tr>`;
}

function clientEmailHTML({ fname }) {
  return `
  <div style="background:#080808;color:#ccc0b4;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto;">
    <div style="border-top:2px solid #8b1a1a;padding-top:24px;margin-bottom:28px;">
      <h1 style="font-family:Georgia,serif;font-size:28px;color:#e8ddd0;letter-spacing:0.08em;margin:0 0 8px;">INKWELL STUDIO</h1>
      <p style="color:#7a6a60;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;margin:0;">Custom Tattoo · By Appointment</p>
    </div>

    <p style="font-size:22px;color:#e8ddd0;margin:0 0 16px;">Thank you, ${fname}.</p>
    <p style="font-size:17px;line-height:1.75;color:#ccc0b4;font-style:italic;margin:0 0 24px;">
      Your booking request has been received. We'll review your details and reach out within <strong style="color:#e8ddd0;font-style:normal;">48 hours</strong> to confirm your session and discuss the details.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#7a6a60;">
      In the meantime, feel free to gather more reference images or think more about placement. The more you can share, the better we can bring your vision to life.
    </p>

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #2a2020;font-size:11px;color:#3d302e;letter-spacing:0.2em;text-transform:uppercase;">
      Inkwell Studio · This is an automated confirmation
    </div>
  </div>`;
}
