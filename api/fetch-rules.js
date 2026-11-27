import dns from 'node:dns/promises';
import net from 'node:net';
import { adminClient, anonClient, send, clientIp, rateLimit } from './_lib.js';
import { extractRules, keywordFallback } from './_rules.js';

const MAX_BYTES = 2.5 * 1024 * 1024;

async function requireGM(req, admin) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await anonClient().auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: p } = await admin.from('profiles').select('role,status').eq('id', data.user.id).maybeSingle();
  return p && p.role === 'gm' && p.status === 'active' ? data.user.id : null;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? isPrivateIp(m[1]) : false;
  }
  return true;
}

async function assertPublic(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { throw new Error('ลิงก์ไม่ถูกต้อง'); }
  if (u.protocol !== 'https:' || (u.port && u.port !== '443')) throw new Error('ต้องเป็นลิงก์ https เท่านั้น');
  if (net.isIP(u.hostname)) throw new Error('ไม่รองรับลิงก์ที่เป็นเลข IP');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('ลิงก์นี้ไม่อนุญาต');
  return u;
}

async function fetchText(start, timeoutMs) {
  let url = start;
  for (let hop = 0; hop < 4; hop += 1) {
    const u = await assertPublic(url);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(u, {
        redirect: 'manual',
        signal: ctl.signal,
        headers: { 'User-Agent': 'AorticaRulesFetch/1.0', Accept: 'text/html,application/javascript,*/*' },
      });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        url = new URL(r.headers.get('location'), u).toString();
        await r.body?.cancel();
        continue;
      }
      if (!r.ok) throw new Error(`หน้าเกมตอบกลับ HTTP ${r.status}`);
      const chunks = [];
      let size = 0;
      for await (const ch of r.body) {
        size += ch.length;
        if (size > MAX_BYTES) break;
        chunks.push(ch);
      }
      return { text: Buffer.concat(chunks).toString('utf8'), url: u };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('เปลี่ยนเส้นทางหลายครั้งเกินไป');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const admin = adminClient();
  try {
    const uid = await requireGM(req, admin);
    if (!uid) return send(res, 403, { error: 'เฉพาะ GM เท่านั้น' });
    if (!(await rateLimit(admin, `rules:${clientIp(req)}`, 20, 600))) {
      return send(res, 429, { error: 'ทำรายการบ่อยเกินไป กรุณารอสักครู่' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const page = await fetchText(String(body.url || '').trim(), 7000);

    // สคริปต์ภายนอกในโดเมนเดียวกับเกม (สูงสุด 3 ไฟล์)
    const srcs = [...page.text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
    const scripts = [];
    for (const s of srcs) {
      if (scripts.length >= 3) break;
      let abs;
      try { abs = new URL(s, page.url); } catch { continue; }
      if (abs.host !== page.url.host) continue;
      try { scripts.push((await fetchText(abs.toString(), 4000)).text); } catch { /* ข้ามไฟล์ที่ดึงไม่ได้ */ }
    }

    return send(res, 200, { candidates: extractRules(page.text, scripts) });
  } catch (e) {
    console.error('fetch-rules', e);
    const found = extractRules(page.text, scripts);
    const fb = keywordFallback(page.text, scripts);
    const candidates = [...found, ...fb].slice(0, 5);
    return send(res, 200, { candidates, info: { ...fb.info, structured: found.length } });
  }
}
