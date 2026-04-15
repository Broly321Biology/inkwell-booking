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
      description, size,
      budget, date1, date2, timeOfDay,
      fileNames
    } = req.body;

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

    if (dbError) throw new Error('Database error: ' + dbError.message);

    await resend.emails.send({
      from:    'Inkwell Bookings <onboarding@resend.dev>',
      to:      process.env.ARTIST_EMAIL,
      subject: 'New Booking Request - ' + fname + ' ' + lname,
      html:    artistEmailHTML({ fname, lname, email, phone, firstTattoo, placement, placementNote, description, size, budget, date1, date2, timeOfDay, fileNames, id: data.id })
    });

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
  const placements = Array.isArray(b.placement) ? b.placement.join(', ') : b.placement;
  const files = b.fileNames && b.fileNames.length ? b.fileNames.join(', ') : 'None uploaded';
  return '<div style="background:#080808;color:#ccc0b4;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto;"><h1 style="color:#e8ddd0;">NEW BOOKING — ' + b.fname + ' ' + b.lname + '</h1><p><b>Email:</b> ' + b.email + '</p><p><b>Phone:</b> ' + (b.phone || '-') + '</p><p><b>First tattoo:</b> ' + (b.firstTattoo ? 'Yes' : 'No') + '</p><p><b>Placement:</b> ' + (placements || '-') + '</p><p><b>Note:</b> ' + (b.placementNote || '-') + '</p><p><b>Size:</b> ' + (b.size || '-') + '</p><p><b>Budget:</b> $' + (b.budget || '-') + '</p><p><b>Description:</b> ' + b.description + '</p><p><b>Date 1:</b> ' + (b.date1 || '-') + '</p><p><b>Date 2:</b> ' + (b.date2 || '-') + '</p><p><b>Time:</b> ' + (b.timeOfDay || '-') + '</p><p><b>Files:</b> ' + files + '</p></div>';
}

function clientEmailHTML({ fname }) {
  return '<div style="background:#080808;color:#ccc0b4;font-family:Georgia,serif;padding:40px;max-width:600px;margin:0 auto;"><h1 style="color:#e8ddd0;">Thank you, ' + fname + '.</h1><p style="font-size:17px;">Your booking request has been received. We will be in touch within 48 hours.</p></div>';
}
