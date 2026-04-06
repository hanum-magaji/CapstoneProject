import { createClient } from '@supabase/supabase-js';

// Use server-side service role key - set this in Vercel environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.error('deleteRequirement API: missing supabase env vars');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabase) return res.status(500).json({ error: 'Supabase not configured on server' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const { error } = await supabase.from('requirements').delete().eq('id', id);
    if (error) {
      console.error('deleteRequirement error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('deleteRequirement handler exception:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
