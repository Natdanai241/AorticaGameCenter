import { adminClient } from './_lib.js';
import { verifyShot } from './_shot.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const { g, e, s } = req.query || {};
  if (req.method !== 'GET' || !UUID_RE.test(String(g || '')) || !verifyShot(String(g), e, s)) {
    return res.status(403).send('Forbidden');
  }
  try {
    const { data, error } = await adminClient()
      .from('game_sources').select('play_url').eq('game_id', g).maybeSingle();
    if (error || !data?.play_url || !/^https:\/\/\S+$/.test(data.play_url)) {
      return res.status(404).send('Not found');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      `<!doctype html><html lang="th"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"><title>shot</title>` +
      `<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}` +
      `iframe{border:0;width:100%;height:100%;display:block}</style></head>` +
      `<body><iframe src="${escAttr(data.play_url)}" allow="autoplay; fullscreen"></iframe></body></html>`,
    );
  } catch (err) {
    console.error('shot-page', err);
    return res.status(500).send('Error');
  }
}
