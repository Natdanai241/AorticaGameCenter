// Validated registration. New accounts are always Pending Approval (enforced by DB trigger).
import {
  adminClient, anonClient, send, clientIp, rateLimit,
  USERNAME_RE, EMAIL_RE, passwordProblem, SERVER_ERROR,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const username = String(b.username || '').trim().toLowerCase();
    const displayName = String(b.display_name || '').trim().slice(0, 50);
    const password = b.password;

    if (!EMAIL_RE.test(email) || email.length > 254) return send(res, 400, { error: 'รูปแบบอีเมลไม่ถูกต้อง' });
    if (!USERNAME_RE.test(username)) {
      return send(res, 400, { error: 'ชื่อผู้ใช้ต้องมี 3–20 ตัว ใช้ได้เฉพาะ a-z, 0-9 และ _' });
    }
    if (!displayName) return send(res, 400, { error: 'กรุณากรอกชื่อที่แสดง' });
    const pwErr = passwordProblem(password);
    if (pwErr) return send(res, 400, { error: pwErr });

    const admin = adminClient();
    if (!(await rateLimit(admin, `register:ip:${clientIp(req)}`, 5, 3600))) {
      return send(res, 429, { error: 'มีการสมัครจากเครือข่ายนี้บ่อยเกินไป กรุณาลองใหม่ภายหลัง' });
    }

    const { data: setting } = await admin.from('platform_settings')
      .select('value').eq('key', 'registration_open').maybeSingle();
    if (setting && setting.value === false) {
      return send(res, 403, { error: 'ขณะนี้ปิดรับสมัครสมาชิกชั่วคราว' });
    }

    const [{ data: u }, { data: e }] = await Promise.all([
      admin.from('profiles').select('id').eq('username', username).maybeSingle(),
      admin.from('profiles').select('id').eq('email', email).maybeSingle(),
    ]);
    if (u) return send(res, 409, { error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
    if (e) return send(res, 409, { error: 'อีเมลนี้ถูกใช้สมัครแล้ว' });

    const { data, error } = await anonClient().auth.signUp({
      email, password,
      options: { data: { username, display_name: displayName }, emailRedirectTo: process.env.SITE_URL },
    });
    if (error) {
      if (/already registered/i.test(error.message)) return send(res, 409, { error: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
      if (/password/i.test(error.message)) return send(res, 400, { error: 'รหัสผ่านไม่ผ่านเงื่อนไขความปลอดภัย' });
      console.error('signUp', error);
      return send(res, 400, { error: 'ไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบข้อมูลอีกครั้ง' });
    }

    const needsConfirm = !data.session;
    send(res, 201, {
      message: needsConfirm
        ? 'สมัครสมาชิกสำเร็จ! กรุณายืนยันอีเมลของคุณ จากนั้นรอ GM อนุมัติบัญชี'
        : 'สมัครสมาชิกสำเร็จ! บัญชีของคุณกำลังรอการอนุมัติจาก GM',
    });
  } catch (e) {
    console.error('register', e);
    send(res, 500, { error: SERVER_ERROR });
  }
}
