// ดึงข้อความ "กติกา / วิธีเล่น" จาก HTML ของหน้าเกม (ไม่ใช้ไลบรารีภายนอก)
const KW = /(กติกา|วิธีเล่น|วิธีการเล่น|how\s*to\s*play|rules?)/i;
const ATTR_KW = /(rule|howto|how-to|how_to|help|guide|tutorial|instruction|manual|กติกา)/i;
const MAX_TEXT = 4000;

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", hellip: '…', ndash: '–', mdash: '—' };
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

export function htmlToText(html) {
  let s = String(html)
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|li|ul|ol|tr|h[1-6]|section|article|header|footer|table|details|summary)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decode(s).replace(/\$\{[^}]*\}/g, ' ');
  const lines = s.split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim());
  const junk = /^(ปิด|close|ok|ตกลง|เข้าใจแล้ว|เข้าใจ|เริ่มเกม|×|✕|x)$/i;
  const out = [];
  for (const l of lines) {
    if (!l || junk.test(l)) { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n\s*\n(?=• )/g, '\n').trim();
}

// หาตำแหน่งปิดของแท็กที่เปิดที่ start (นับซ้อนแท็กชื่อเดียวกัน)
function elementEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) depth -= 1; else depth += 1;
    if (depth === 0) return re.lastIndex;
    if (re.lastIndex - start > 80000) break;
  }
  return -1;
}

const unesc = (s) => s
  .replace(/\\u\{([0-9a-f]+)\}/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\n/g, '\n')
  .replace(/\\t/g, ' ')
  .replace(/\\(['"`\\/])/g, '$1');

const cands = [];
const add = (source, prio, raw, isHtml = true) => {
  const text = (isHtml ? htmlToText(raw) : String(raw)).trim();
  if (text.length < 60 || text.length > 12000) return;
  const hits = (text.match(new RegExp(KW.source, 'gi')) || []).length;
  const sweet = text.length >= 150 && text.length <= 3000 ? 15 : 0;
  cands.push({ source, text, score: prio + Math.min(hits, 5) * 3 + sweet });
};

function fromExplicit(html) {
  const m = html.match(/<(script|template|div|section)\b[^>]*id=["']aortica-rules["'][^>]*>([\s\S]*?)<\/\1>/i);
  if (m) add('บล็อก aortica-rules ของเกม', 100, m[2]);
}

function fromAttrs(html) {
  const re = /<(div|section|article|aside|dialog|details|ul|ol|template)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2];
    const a = attrs.match(/\b(?:id|class)\s*=\s*["']([^"']*)["']/gi);
    if (!a || !a.some((x) => ATTR_KW.test(x))) continue;
    const end = elementEnd(html, m.index, m[1].toLowerCase());
    if (end < 0) continue;
    add('กล่องกติกาในหน้าเกม', 60, html.slice(m.index, end));
  }
}

function fromHeadings(html) {
  const re = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html))) {
    const title = htmlToText(m[2]);
    if (title.length > 60 || !KW.test(title)) continue;
    const level = Number(m[1][1]);
    const rest = html.slice(re.lastIndex, re.lastIndex + 9000);
    const next = rest.search(new RegExp(`<h[1-${level}]\\b`, 'i'));
    add('ใต้หัวข้อ “' + title.slice(0, 30) + '”', 50, next > 0 ? rest.slice(0, next) : rest.slice(0, 5000));
  }
}

function fromScripts(js) {
  // 1) ข้อความ (template / quote) ที่มีคำว่ากติกา และยาวพอ
  const lit = /`((?:\\[\s\S]|[^`\\])*)`|"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'/g;
  let m;
  while ((m = lit.exec(js))) {
    const body = m[1] ?? m[2] ?? m[3] ?? '';
    if (body.length < 120 || !KW.test(body)) continue;
    add('ข้อความในสคริปต์ของเกม', 40, unesc(body));
  }
  // 1.5) ตัวแปรข้อความยาวที่ชื่อบอกว่าเป็นกติกา เช่น const RULES_TEXT = `...`
  const named = /(?:const|let|var)\s+\w*(?:RULES?|HOWTO|HELP|GUIDE|TUTORIAL)\w*\s*=\s*`((?:\\[\s\S]|[^`\\])*)`/gi;
  while ((m = named.exec(js))) add('ตัวแปรกติกาในสคริปต์', 45, unesc(m[1]));
  // 2) ตัวแปรรายการกติกา เช่น const RULES = ['...', '...']
  const arr = /(?:const|let|var)\s+\w*(?:RULES?|HOWTO|HELP|GUIDE|TUTORIAL|กติกา)\w*\s*=\s*(\[[\s\S]*?\]\s*;|\{[\s\S]*?\}\s*;)/gi;
  while ((m = arr.exec(js))) {
    const items = [];
    const sl = /`((?:\\[\s\S]|[^`\\])*)`|"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'/g;
    let k;
    while ((k = sl.exec(m[1]))) {
      const t = htmlToText(unesc(k[1] ?? k[2] ?? k[3] ?? ''));
      if (t.length >= 8 && /[ก-๙A-Za-z]/.test(t) && !/^(https?:|#|\.|\/)/.test(t)) items.push(`• ${t}`);
    }
    if (items.length >= 3) add('รายการกติกาในสคริปต์', 35, items.join('\n'), false);
  }
}

export function extractRules(pageHtml, scriptTexts = []) {
  cands.length = 0;
  const staticHtml = pageHtml.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  fromExplicit(pageHtml);
  fromAttrs(staticHtml);
  fromHeadings(staticHtml);
  const inline = [...pageHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[1]);
  for (const js of [...inline, ...scriptTexts]) fromScripts(js);
  const norm = (t) => t.replace(/[\s•]+/g, '');
  const kept = [];
  for (const c of cands.sort((a, b) => b.score - a.score)) {
    const n = norm(c.text);
    const dup = kept.some((k) => k.n.includes(n.slice(0, 60)) || n.includes(k.n.slice(0, 60)));
    if (!dup) kept.push({ ...c, n });
  }
  return kept
    .slice(0, 4)
    .map((c) => ({ source: c.source, text: c.text.slice(0, MAX_TEXT) }));
}


// ตัวสำรอง: เมื่อไม่พบกล่องกติกาที่ชัดเจน ให้ดึงข้อความรอบคำว่า "กติกา / วิธีเล่น"
export function keywordFallback(pageHtml, scriptTexts = []) {
  const out = [];
  const kw = /(กติกา|วิธีเล่น|วิธีการเล่น)/;
  const kwG = /(กติกา|วิธีเล่น|วิธีการเล่น)/g;
  const THAI = /[ก-๙]/;
  const staticHtml = pageHtml.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  const inline = [...pageHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[1]);
  const scripts = [...inline, ...scriptTexts];

  // 1) ข้อความรอบคำในหน้า HTML
  const text = htmlToText(staticHtml);
  const i = text.search(kw);
  if (i >= 0) {
    const win = text.slice(i, i + 1500).trim();
    if (win.length >= 60) out.push({ source: 'ข้อความรอบคำว่า “กติกา” ในหน้าเกม (ต้องตรวจและแก้เอง)', text: win.slice(0, MAX_TEXT) });
  }

  // 2) ข้อความไทยที่อยู่ใกล้คำนั้นในสคริปต์ (เช่น กติกาที่สร้างด้วยโค้ด)
  for (const js of scripts) {
    const j = js.search(kw);
    if (j < 0) continue;
    const win = js.slice(Math.max(0, j - 200), j + 4500);
    const lit = /`((?:\\[\s\S]|[^`\\])*)`|"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'/g;
    const lines = [];
    let m;
    while ((m = lit.exec(win))) {
      const t = htmlToText(unesc(m[1] ?? m[2] ?? m[3] ?? ''));
      if (t.length >= 10 && THAI.test(t) && !lines.includes(t)) lines.push(t);
    }
    if (lines.length >= 3) {
      out.push({ source: 'ข้อความไทยใกล้คำว่า “กติกา” ในสคริปต์ (ต้องตรวจและแก้เอง)', text: lines.slice(0, 30).map((t) => `• ${t}`).join('\n').slice(0, MAX_TEXT) });
      break;
    }
  }
  // ข้อมูลช่วยวิเคราะห์ ใช้แสดงเมื่อไม่พบอะไรเลย
  const count = (str) => (str.match(kwG) || []).length;
  out.info = {
    chars: pageHtml.length,
    scripts: scripts.length,
    kwHtml: count(text),
    kwJs: scripts.reduce((n, js) => n + count(js), 0),
  };
  return out;
}
