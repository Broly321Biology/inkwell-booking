const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      fname, lname, email, phone,
      firstTattoo, placement, placementNote,
      description, size, budget,
      date1, date2, timeOfDay,
      refFiles   // array of { name, type, base64 }
    } = req.body;

    // ── 1. Upload reference images ───────────────────────────────
    const uploadedUrls = [];

    if (Array.isArray(refFiles)) {
      for (const file of refFiles) {
        const buffer   = Buffer.from(file.base64, 'base64');
        const safeName = Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = 'bookings/' + safeName;

        const { error: uploadError } = await supabase.storage
          .from('references')
          .upload(filePath, buffer, { contentType: file.type || 'application/octet-stream' });

        if (uploadError) { console.error('Upload error:', uploadError); continue; }

        const { data: signedData } = await supabase.storage
          .from('references')
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

        if (signedData?.signedUrl) {
          uploadedUrls.push({ name: file.name, url: signedData.signedUrl });
        }
      }
    }

    // ── 2. Save to Supabase DB ───────────────────────────────────
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
        file_names:      uploadedUrls.map(f => f.name),
        status:          'new'
      }])
      .select()
      .single();

    if (dbError) throw new Error('Database error: ' + dbError.message);

    // ── 3. Email the artist ──────────────────────────────────────
    await resend.emails.send({
      from:    'Inkwell Bookings <onboarding@resend.dev>',
      to:      process.env.ARTIST_EMAIL,
      subject: 'New Booking — ' + fname + ' ' + lname,
      html:    artistEmailHTML({ fname, lname, email, phone, firstTattoo, placement, placementNote, description, size, budget, date1, date2, timeOfDay, uploadedUrls, id: data.id })
    });

    // ── 4. Confirmation to client ────────────────────────────────
    await resend.emails.send({
      from:    'Inkwell Studio <onboarding@resend.dev>',
      to:      process.env.ARTIST_EMAIL,
      subject: 'Booking confirmation for ' + fname,
      html:    clientEmailHTML({ fname })
    });

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
};

function artistEmailHTML(b) {
  const placements  = Array.isArray(b.placement) ? b.placement.join(', ') : b.placement;
  const fileLinks   = b.uploadedUrls && b.uploadedUrls.length
    ? b.uploadedUrls.map(f => '<a href="' + f.url + '" style="color:#c0392b;display:block;margin-bottom:8px;font-size:14px;">\u2197 ' + f.name + '</a>').join('')
    : '<span style="color:#7a6a60;">None uploaded</span>';

  return '<div style="background:#080808;color:#ccc0b4;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto;"><div style="border-top:2px solid #8b1a1a;padding-top:24px;margin-bottom:32px;"><h1 style="font-family:Georgia,serif;font-size:32px;color:#e8ddd0;letter-spacing:0.1em;margin:0 0 4px;">NEW BOOKING REQUEST</h1><p style="color:#7a6a60;font-size:12px;letter-spacing:0.3em;text-transform:uppercase;margin:0;">Ref #' + (b.id ? b.id.slice(0,8).toUpperCase() : 'PENDING') + '</p></div><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;width:140px;">Name</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + b.fname + ' ' + b.lname + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Email</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;"><a href="mailto:' + b.email + '" style="color:#c0392b;">' + b.email + '</a></td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Phone</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.phone || '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">First Tattoo</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.firstTattoo ? 'Yes' : 'No') + '</td></tr><tr><td colspan="2" style="padding:14px 12px 6px;font-family:monospace;font-size:9px;letter-spacing:0.3em;color:#8b1a1a;border-bottom:1px solid #2a2020;">&mdash; DESIGN</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Placement</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (placements || '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Note</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.placementNote || '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Size</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.size || '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Budget</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.budget ? '$' + b.budget : '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;vertical-align:top;">Description</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;"><em style="color:#e8ddd0;">' + b.description + '</em></td></tr><tr><td colspan="2" style="padding:14px 12px 6px;font-family:monospace;font-size:9px;letter-spacing:0.3em;color:#8b1a1a;border-bottom:1px solid #2a2020;">&mdash; AVAILABILITY</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Date 1</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.date1 || '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Date 2</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.date2 || '&mdash;') + '</td></tr><tr><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-family:monospace;font-size:10px;color:#7a6a60;text-transform:uppercase;">Time</td><td style="padding:10px 12px;border-bottom:1px solid #1c1717;font-size:15px;">' + (b.timeOfDay || '&mdash;') + '</td></tr><tr><td colspan="2" style="padding:14px 12px 6px;font-family:monospace;font-size:9px;letter-spacing:0.3em;color:#8b1a1a;border-bottom:1px solid #2a2020;">&mdash; REFERENCE IMAGES</td></tr><tr><td colspan="2" style="padding:14px 12px;">' + fileLinks + '</td></tr></table><div style="margin-top:32px;padding-top:16px;border-top:1px solid #2a2020;font-size:11px;color:#3d302e;letter-spacing:0.2em;text-transform:uppercase;">Inkwell Studio &middot; Booking System</div></div>';
}

function clientEmailHTML({ fname }) {
  return '<div style="background:#080808;color:#ccc0b4;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto;"><div style="border-top:2px solid #8b1a1a;padding-top:24px;margin-bottom:28px;"><h1 style="font-family:Georgia,serif;font-size:28px;color:#e8ddd0;">INKWELL STUDIO</h1><p style="color:#7a6a60;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;">Custom Tattoo &middot; By Appointment</p></div><p style="font-size:22px;color:#e8ddd0;margin:0 0 16px;">Thank you, ' + fname + '.</p><p style="font-size:17px;line-height:1.75;color:#ccc0b4;font-style:italic;">Your booking request has been received. We will reach out within <strong style="color:#e8ddd0;font-style:normal;">48 hours</strong> to confirm your session.</p><div style="margin-top:40px;padding-top:16px;border-top:1px solid #2a2020;font-size:11px;color:#3d302e;letter-spacing:0.2em;text-transform:uppercase;">Inkwell Studio &middot; Automated confirmation</div></div>';
}
