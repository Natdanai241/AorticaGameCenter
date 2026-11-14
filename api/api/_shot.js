import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => process.env.SHOT_SECRET || '';

export function signShot(gameId, exp) {
  return createHmac('sha256', secret()).update(`${gameId}.${exp}`).digest('hex');
}

export function verifyShot(gameId, exp, sig) {
  if (!secret() || !gameId || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now()) return false;
  const a = Buffer.from(signShot(gameId, e), 'hex');
  const b = Buffer.from(String(sig), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
