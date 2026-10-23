// Username-or-email login. Resolves username → email server-side so emails are never exposed.
import { adminClient, anonClient, send, clientIp, rateLimit, SERVER_ERROR } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const { username, password } = req.body || {};
    const id = String(username || '').trim().toLowerCase();
    if (!id || typeof password !== 'string' || !password) {
      return send(res, 400, { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const admin = adminClient();
    const okIp = await rateLimit(admin, `login:ip:${clientIp(req)}`, 30, 900);
    const okUser = okIp && await rateLimit(admin, `login:user:${id}`, 8, 900);
    if (!okIp || !okUser) {
      return send(res, 429, { error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' });
    }

    let email = null;
    if (id.includes('@')) {
      email = id;
    } else {
      const { data } = await admin.from('profiles').select('email').eq('username', id).maybeSingle();
      email = data?.email ?? null;
    }

    const generic = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    if (!email) return send(res, 401, { error: generic });

    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        return send(res, 403, { error: 'กรุณายืนยันอีเมลจากลิงก์ที่ส่งไปให้ก่อนเข้าสู่ระบบ' });
      }
      return send(res, 401, { error: generic });
    }

    send(res, 200, {
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    });
  } catch (e) {
    console.error('login', e);
    send(res, 500, { error: SERVER_ERROR });
  }
}
