// Exposes ONLY public values. The anon key is designed to be public; RLS protects data.
import { send } from './_lib.js';

export default function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return send(res, 503, { error: 'not_configured' });
  send(res, 200, { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY });
}
