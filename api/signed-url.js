const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName required' });

    // Find the file in storage by scanning bookings/ prefix
    const { data: list } = await supabase.storage.from('references').list('bookings');
    const match = list?.find(f => f.name.includes(fileName.replace(/[^a-zA-Z0-9._-]/g, '_')) || f.name.endsWith(fileName));

    const filePath = match ? `bookings/${match.name}` : `bookings/${fileName}`;

    const { data, error } = await supabase.storage
      .from('references')
      .createSignedUrl(filePath, 60 * 60); // 1 hour

    if (error) throw new Error(error.message);

    return res.status(200).json({ url: data.signedUrl });
  } catch (err) {
    console.error('Signed URL error:', err);
    return res.status(500).json({ error: err.message });
  }
};
