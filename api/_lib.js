// Shared helpers for /api routes.
import { createClient } from '@supabase/supabase-js';

export const SERVER_ERROR = 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Accepts the URL with or without a trailing /rest/v1/ and returns the project origin.
function baseUrl() {
  const raw = String(process.env.SUPABASE_URL || '').trim();
  try { return new URL(raw).origin; } catch { return raw; }
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient() {
  return createClient(baseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
}

export function anonClient() {
  return createClient(baseUrl(), process.env.SUPABASE_ANON_KEY, opts);
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || String(req.headers['x-real-ip'] || '') || 'unknown';
}

// Returns true if the request is allowed. Needs the rate_limit_hit() SQL function (Step 3).
export async function rateLimit(admin, key, max, windowSeconds) {
  try {
    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_key: key, p_max: max, p_window: windowSeconds,
    });
    if (error) { console.error('rateLimit', error.message); return true; }
    return data === true;
  } catch (e) {
    console.error('rateLimit', e);
    return true;
  }
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string') return 'กรุณากรอกรหัสผ่าน';
  if (pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (pw.length > 72) return 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข';
  return null;
}
