import { adminClient, anonClient, send, clientIp, rateLimit } from './_lib.js';
import { signShot } from './_shot.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const BUCKET = 'game-media';
const AUTO_MARK = `/storage/v1/object/public/${BUCKET}/auto/`;

async function requireGM(req, admin) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: p } = await admin.from('profiles').select('role,status').eq('id', data.user.id).maybeSingle();
  return p && p.role === 'gm' && p.status === 'active' ? data.user.id : null;
}

async function setting(admin, key, fallback) {
  const { data } = await admin.from('platform_settings').select('value').eq('key', key).maybeSingle();
  return data && data.value !== null && data.value !== undefined ? data.value : fallback;
}

async function fetchShot(pageUrl) {
  const q = new URLSearchParams({
    url: pageUrl,
    screenshot: 'true',
    meta: 'false',
    'viewport.width': '1280',
    'viewport.height': '720',
    waitForTimeout: '5000',
  });
  const headers = process.env.MICROLINK_API_KEY ? { 'x-api-key': process.env.MICROLINK_API_KEY } : {};
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(`https://api.microlink.io/?${q}`, { headers, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.status !== 'success') throw new Error(`Microlink: ${j.message || j.code || r.status}`);
    const imgUrl = j?.data?.screenshot?.url;
    if (!imgUrl) throw new Error('Microlink ไม่ส่งภาพกลับมา');
    const ir = await fetch(imgUrl, { signal: ctl.signal });
    if (!ir.ok) throw new Error(`ดาวน์โหลดภาพไม่สำเร็จ (${ir.status})`);
    const type = (ir.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error('ไฟล์ที่ได้ไม่ใช่รูปภาพ');
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length < 2000 || buf.length > 4.5 * 1024 * 1024) throw new Error('ขนาดภาพไม่เหมาะสม');
    return { buf, type };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const admin = adminClient();
  let jobId = null;
  try {
    const uid = await requireGM(req, admin);
    if (!uid) return send(res, 403, { error: 'เฉพาะ GM เท่านั้น' });
    if (!(await rateLimit(admin, `media:${clientIp(req)}`, 12, 600))) {
      return send(res, 429, { error: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const gameId = String(body.gameId || '');
    if (!UUID_RE.test(gameId)) return send(res, 400, { error: 'ข้อมูลไม่ถูกต้อง' });
    const force = body.force === true;

    if ((await setting(admin, 'auto_media_enabled', true)) === false) return send(res, 200, { skipped: 'disabled' });

    const [{ data: game }, { data: src }] = await Promise.all([
      admin.from('games').select('id, screenshots').eq('id', gameId).maybeSingle(),
      admin.from('game_sources').select('play_url, media_url').eq('game_id', gameId).maybeSingle(),
    ]);
    if (!game || !src?.play_url) return send(res, 404, { error: 'ไม่พบเกมหรือลิงก์เล่นเกม' });
    if (!force && src.media_url === src.play_url) return send(res, 200, { skipped: 'unchanged' });

    const recent = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: busy } = await admin.from('media_jobs').select('id', { count: 'exact', head: true })
      .eq('game_id', gameId).eq('kind', 'screenshot').eq('status', 'working').gte('created_at', recent);
    if (busy) return send(res, 200, { skipped: 'busy' });

    const cap = Number(await setting(admin, 'auto_shot_daily_cap', 40)) || 40;
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: used } = await admin.from('media_jobs').select('id', { count: 'exact', head: true })
      .eq('kind', 'screenshot').neq('status', 'error').gte('created_at', dayAgo);
    if ((used || 0) >= cap) return send(res, 429, { error: `ครบเพดานแคปภาพวันนี้แล้ว (${cap} ภาพ)` });

    const { data: job } = await admin.from('media_jobs').insert({ game_id: gameId, kind: 'screenshot' })
      .select('id').single();
    jobId = job?.id ?? null;

    const site = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
    if (!site || !process.env.SHOT_SECRET) throw new Error('ตั้งค่า SITE_URL หรือ SHOT_SECRET ใน Vercel ไม่ครบ');
    const exp = Date.now() + 5 * 60 * 1000;
    const pageUrl = `${site}/api/shot-page?g=${gameId}&e=${exp}&s=${signShot(gameId, exp)}`;

    const { buf, type } = await fetchShot(pageUrl);
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const path = `auto/${gameId}/shot-${Date.now()}.${ext}`;
    const up = await admin.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: false });
    if (up.error) throw new Error(`อัปโหลดไม่สำเร็จ: ${up.error.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    // เก็บรูปที่ GM ใส่เอง ลบเฉพาะรูปที่ระบบแคปไว้ก่อนหน้า
    const old = Array.isArray(game.screenshots) ? game.screenshots.filter((u) => typeof u === 'string') : [];
    const manual = old.filter((u) => !u.includes(AUTO_MARK));
    const oldAuto = old.filter((u) => u.includes(AUTO_MARK));
    const next = [...manual, url].slice(0, 12);
    const { error: ue } = await admin.from('games').update({ screenshots: next }).eq('id', gameId);
    if (ue) throw new Error(ue.message);
    await admin.from('game_sources').update({ media_url: src.play_url }).eq('game_id', gameId);

    const marker = `/object/public/${BUCKET}/`;
    const stale = oldAuto.map((u) => decodeURIComponent(u.split(marker)[1] || '')).filter(Boolean);
    if (stale.length) await admin.storage.from(BUCKET).remove(stale);

    await admin.from('media_jobs').update({ status: 'done', finished_at: new Date().toISOString() }).eq('id', jobId);
    return send(res, 200, { ok: true, url });
  } catch (e) {
    console.error('game-media', e);
    const msg = String(e?.message || e).slice(0, 200);
    if (jobId) {
      await admin.from('media_jobs')
        .update({ status: 'error', error: msg, finished_at: new Date().toISOString() }).eq('id', jobId);
    }
    return send(res, 502, { error: `แคปภาพหน้าจอไม่สำเร็จ: ${msg}` });
  }
}
