// ตรวจลิงก์เกมทุกเกมแล้วบันทึกผลลงตาราง link_checks (รันโดย GitHub Actions)
const base = (() => {
  const raw = String(process.env.SUPABASE_URL || '').trim();
  try { return new URL(raw).origin; } catch { return raw.replace(/\/+$/, ''); }
})();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('ตั้งค่า SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ไม่ครบ');
  process.exit(1);
}

const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function rest(path, opts = {}) {
  const r = await fetch(`${base}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${path.split('?')[0]}: HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

async function probe(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: ctl.signal,
      headers: { 'User-Agent': 'AorticaLinkCheck/1.0' },
    });
    await r.body?.cancel();
    const ok = r.status >= 200 && r.status < 400;
    return { ok, code: r.status, error: ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'หมดเวลา (20 วินาที)' : String(e.message || e).slice(0, 150);
    return { ok: false, code: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

const sources = await rest('game_sources?select=game_id,play_url');
const prevRows = await rest('link_checks?select=game_id,fail_count');
const prev = Object.fromEntries(prevRows.map((r) => [r.game_id, r.fail_count]));

const results = [];
let next = 0;
async function worker() {
  while (next < sources.length) {
    const s = sources[next++];
    let res = await probe(s.play_url);
    if (!res.ok) {
      await new Promise((ok) => setTimeout(ok, 3000));
      res = await probe(s.play_url);
    }
    results.push({
      game_id: s.game_id,
      status: res.ok ? 'ok' : 'fail',
      http_code: res.code,
      error: res.error,
      checked_at: new Date().toISOString(),
      fail_count: res.ok ? 0 : (prev[s.game_id] || 0) + 1,
    });
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

if (results.length) {
  await rest('link_checks?on_conflict=game_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(results),
  });
}

const bad = results.filter((r) => r.status === 'fail');
const dead = results.filter((r) => r.fail_count >= 2);
// ไม่พิมพ์ชื่อเกมหรือลิงก์ลงล็อก เพราะล็อกของ repo สาธารณะใครก็เปิดดูได้ ดูรายละเอียดในหน้า GM
console.log(`ตรวจ ${results.length} เกม ปกติ ${results.length - bad.length} มีปัญหา ${bad.length} เสียติดกัน 2 วันขึ้นไป ${dead.length}`);
if (dead.length) process.exitCode = 1;
