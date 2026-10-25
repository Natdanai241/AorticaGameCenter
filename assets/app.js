/* Aortica Game Center — client SPA (vanilla ES modules).
 * This file contains NO secrets and makes NO authorization decisions that matter:
 * every privileged action is enforced by Supabase RLS / SECURITY DEFINER functions
 * or by the /api serverless routes. UI checks exist only for convenience. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------------------------------------------------------------- helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = () => $('#main');
const one = (x) => (Array.isArray(x) ? x[0] : x) || null;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fromDateInput = (v, end = false) => (v ? new Date(`${v}T${end ? '23:59:59' : '00:00:00'}`).toISOString() : null);

const TIERS = ['normal', 'plus', 'pro', 'vip'];
const TIER_LABEL = { normal: 'Normal', plus: 'Plus', pro: 'Pro', vip: 'VIP' };
const tierRank = (t) => TIERS.indexOf(t) + 1;
const STATUS_TH = { pending: 'รออนุมัติ', active: 'ใช้งานอยู่', rejected: 'ถูกปฏิเสธ', suspended: 'ถูกระงับ' };
const MS_TH = { active: 'ใช้งานอยู่', expired: 'หมดอายุ', suspended: 'ระงับ', cancelled: 'ยกเลิก' };
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const pwProblem = (pw) =>
  pw.length < 8 ? 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
  : (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) ? 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข' : null;
const priceText = (t) =>
  t.price_monthly === null || t.price_monthly === undefined ? 'รอประกาศราคา'
  : Number(t.price_monthly) === 0 ? 'ฟรี' : `฿${Number(t.price_monthly).toLocaleString('th-TH')} / เดือน`;

const ICONS = {
  all: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  cards: '<path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 5-3 4 3 4 3-4z"/>',
  action: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  puzzle: '<path d="M10 3a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v4h-4v-2a2 2 0 0 0-4 0v2H6v-4h2a2 2 0 0 0 0-4H6V5h4z"/>',
  adventure: '<path d="M12 3 2 21h20zm0 5 5.5 10h-11z"/>',
  sports: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  other: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>',
  dice: '<path fill-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm2.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
  coin: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/>',
  star: '<path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6L2.5 9.5l6.6-.8z"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  bomb: '<circle cx="11" cy="14" r="7.5"/><path d="M16 8l3-3m0 0 1-2m-1 2 2 .5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  search: '<path d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/>',
  user: '<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  logout: '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5zm6.6 4.6L15.2 9l2 2H9v2h8.2l-2 2 1.4 1.4L21 12z"/>',
  check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
  info: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/>',
  plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
};
const icon = (k, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[k] || ICONS.other}</svg>`;
const tierBadge = (t, size = '') => (t ? `<span class="tier t-${t} ${size}">${TIER_LABEL[t]}</span>` : `<span class="tier t-none ${size}">ไม่มีสิทธิ์</span>`);
const logo = (cls = '') => `<div class="logo ${cls}"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#logo-a"/></svg><div><span class="logo-word">AORTICA</span><span class="logo-sub">GAME CENTER</span></div></div>`;
const loading = () => '<div class="loading" role="status"><span class="spin"></span> กำลังโหลด...</div>';
const errorBox = (msg, back) => `<section class="card errbox" role="alert"><h1>เกิดข้อผิดพลาด</h1><p class="muted">${esc(msg)}</p>${back ? `<a class="btn ghost" href="${back}">ย้อนกลับ</a>` : ''}</section>`;

function toast(msg, type = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = 'toast'; }, 3800);
}

function openModal(html, onMount) {
  const d = $('#modal');
  d.innerHTML = `<div class="modal-inner">${html}</div>`;
  if (!d.open) d.showModal();
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
  onMount?.(d);
  $('input:not([type=hidden]),select,textarea', d)?.focus();
}
const closeModal = () => { const d = $('#modal'); if (d.open) d.close(); };

function confirmModal(title, text, onYes, danger = true) {
  openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
    <div class="row-end"><button class="btn ghost" data-close>ยกเลิก</button><button class="btn ${danger ? 'danger' : 'primary'}" id="yes">ยืนยัน</button></div>`,
  (d) => { $('#yes', d).onclick = (e) => withBusy(e.currentTarget, async () => { await onYes(); closeModal(); }); });
}

async function withBusy(btn, fn, msgEl) {
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-msg'; }
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> กำลังดำเนินการ...'; }
  try { await fn(); }
  catch (e) {
    if (msgEl?.isConnected) { msgEl.textContent = e.message; msgEl.className = 'form-msg err'; }
    else toast(e.message, 'err');
  } finally {
    if (btn?.isConnected) { btn.disabled = false; btn.innerHTML = label; }
  }
}

const ERR_TH = {
  ACCESS_DENIED: 'ระดับสมาชิกของคุณยังไม่สามารถเล่นเกมนี้ได้',
  NO_SOURCE: 'เกมนี้ยังไม่มีลิงก์สำหรับเล่น กรุณาแจ้ง GM',
  CANNOT_MODIFY_SELF: 'ไม่สามารถเปลี่ยนสถานะบัญชีของตัวเองได้',
  TIER_REQUIRED: 'กรุณาเลือกระดับสมาชิกก่อนอนุมัติ',
  INVALID_STATE: 'สถานะบัญชีปัจจุบันไม่สามารถทำรายการนี้ได้',
  INVALID_DATES: 'วันหมดอายุต้องอยู่หลังวันที่เริ่ม',
  INVALID_TIER: 'ระดับสมาชิกไม่ถูกต้อง',
  FORBIDDEN: 'คุณไม่มีสิทธิ์ทำรายการนี้',
};
function dbErr(e) {
  const m = e?.message || '';
  for (const k of Object.keys(ERR_TH)) if (m.includes(k)) return ERR_TH[k];
  if (e?.code === '23505') return 'ข้อมูลซ้ำกับรายการที่มีอยู่แล้ว (เช่น slug)';
  if (e?.code === '23514') return 'ข้อมูลไม่ถูกต้องตามรูปแบบที่กำหนด';
  if (e?.code === '42501' || /row-level security/i.test(m)) return ERR_TH.FORBIDDEN;
  if (/JWT|session/i.test(m)) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  console.error(e);
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}
async function q(p) { const { data, error } = await p; if (error) throw new Error(dbErr(error)); return data; }
async function qc(p) { const { count, error } = await p; if (error) throw new Error(dbErr(error)); return count ?? 0; }

async function api(path, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${state.session?.access_token || ''}`;
  let r;
  try { r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) }); }
  catch { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return j;
}

// ---------------------------------------------------------------- state & boot
let sb;
const state = {
  session: null, profile: null, membership: null, tier: null, tiers: [],
  library: [], categories: [], f: { q: '', cat: 'all', access: 'all', sort: 'new' }, gmUserFilter: 'pending',
};
const isGM = () => state.profile?.role === 'gm';

function go(path) {
  const target = `#/${path}`;
  if (location.hash === target) route(); else location.hash = target;
}

async function boot() {
  startParticles();
  let cfg = null;
  try { const r = await fetch('/api/config'); if (r.ok) cfg = await r.json(); } catch { /* handled below */ }
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    main().innerHTML = `<section class="card center-card">${logo()}<h1>ยังไม่ได้เชื่อมต่อระบบหลังบ้าน</h1>
      <p class="muted">เว็บไซต์นี้ยังไม่ได้ตั้งค่าฐานข้อมูลและระบบยืนยันตัวตน กรุณาติดต่อผู้ดูแลระบบ</p></section>`;
    return;
  }
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  state.session = (await sb.auth.getSession()).data.session;
  sb.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === 'SIGNED_OUT') { resetUser(); route(); }
  });
  addEventListener('hashchange', route);
  route();
}

function resetUser() {
  Object.assign(state, { profile: null, membership: null, tier: null, library: [], categories: [] });
}

async function loadMe() {
  const uid = state.session.user.id;
  const [p, m, t, e] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('memberships').select('*').eq('user_id', uid).maybeSingle(),
    sb.from('membership_tiers').select('*').order('rank'),
    sb.rpc('effective_tier', { p_uid: uid }),
  ]);
  state.profile = p.data || null;
  state.membership = m.data || null;
  state.tiers = t.data || [];
  state.tier = e.data || null;
}

async function logout() {
  await sb.auth.signOut();
  resetUser();
  go('login');
}

// ---------------------------------------------------------------- router
let routeSeq = 0;
async function route() {
  const seq = ++routeSeq;
  const [page = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  closeModal();

  if (!state.session) { chrome(false); return renderAuth(page === 'register' ? 'register' : 'login'); }
  if (!state.profile) {
    main().innerHTML = loading();
    await loadMe();
    if (seq !== routeSeq) return;
  }
  if (!state.profile) { toast('ไม่พบข้อมูลบัญชี กรุณาเข้าสู่ระบบใหม่', 'err'); return logout(); }
  if (state.profile.status !== 'active') { chrome(false); return renderGate(); }
  if (state.profile.must_change_password) { chrome(false); return renderChangePassword(true); }

  chrome(true, page);
  scrollTo(0, 0);
  main().focus({ preventScroll: true });
  switch (page) {
    case 'game': return renderGame(arg);
    case 'play': return renderPlay(arg);
    case 'membership': return renderMembership();
    case 'account': return renderAccount();
    case 'password': return renderChangePassword(false);
    case 'gm': return isGM() ? renderGM(arg || 'overview') : go('library');
    default: return renderLibrary();
  }
}

function chrome(on, page = '') {
  $('#topbar').hidden = !on;
  $('#tabbar').hidden = !on;
  document.body.classList.toggle('has-chrome', on);
  if (!on) return;
  const active = ['game', 'play', ''].includes(page) ? 'library' : page === 'password' ? 'account' : page;
  const items = [['library', 'คลังเกม', 'all'], ['membership', 'ระดับสมาชิก', 'crown'], ['account', 'บัญชีของฉัน', 'user']];
  if (isGM()) items.push(['gm', 'GM', 'shield']);
  const html = items.map(([k, l, i]) =>
    `<a href="#/${k}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${icon(i)}<span>${l}</span></a>`).join('');
  $('#nav').innerHTML = html;
  $('#tabbar').innerHTML = html;
  const p = state.profile;
  const name = p.display_name || p.username;
  $('#userChip').innerHTML = `<a href="#/account" class="chip-user" aria-label="บัญชีของฉัน">
      <span class="avatar" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span>
      <span class="who"><b>${esc(name)}</b>${tierBadge(state.tier)}</span></a>
    <button class="icon-btn" id="logoutBtn" aria-label="ออกจากระบบ" title="ออกจากระบบ">${icon('logout')}</button>`;
  $('#logoutBtn').onclick = logout;
}

// ---------------------------------------------------------------- auth screens
async function renderAuth(tab) {
  const login = `
    <form id="loginForm" class="form" novalidate>
      <label>ชื่อผู้ใช้ หรืออีเมล<input name="username" autocomplete="username" required autocapitalize="none" spellcheck="false"></label>
      <label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="form-msg" id="authMsg" role="alert"></p>
      <button class="btn primary block" type="submit">เข้าสู่ระบบ</button>
      <p class="hint">ยังไม่มีบัญชี? <a href="#/register">สมัครสมาชิก</a> · ลืมรหัสผ่าน? กรุณาติดต่อ GM</p>
    </form>`;
  const register = `
    <form id="regForm" class="form" novalidate>
      <label>อีเมล<input name="email" type="email" autocomplete="email" required></label>
      <label>ชื่อผู้ใช้ (a-z, 0-9, _ ความยาว 3–20 ตัว)<input name="username" autocomplete="username" required autocapitalize="none" spellcheck="false" maxlength="20"></label>
      <label>ชื่อที่แสดง<input name="display_name" required maxlength="50"></label>
      <label>รหัสผ่าน<input name="password" type="password" autocomplete="new-password" required minlength="8"></label>
      <label>ยืนยันรหัสผ่าน<input name="confirm" type="password" autocomplete="new-password" required></label>
      <p class="hint">รหัสผ่านอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข</p>
      <label class="check"><input type="checkbox" name="agree" required> ฉันยอมรับเงื่อนไขการใช้งานของ Aortica Game Center</label>
      <p class="form-msg" id="authMsg" role="alert"></p>
      <button class="btn primary block" type="submit">สมัครสมาชิก</button>
      <p class="hint">บัญชีใหม่ต้องรอ GM อนุมัติก่อนเข้าคลังเกม</p>
    </form>`;

  main().innerHTML = `
    <section class="auth">
      <div class="auth-hero">
        ${logo('xl')}
        <p class="tagline">รวมทุกความสนุก ไว้ในที่เดียว</p>
        <h1 class="hero-title">เริ่มต้นการ<span class="grad">ผจญภัย</span></h1>
        <p class="lead">คลังเกมคุณภาพจาก Aortica Game Center — เข้าสู่ระบบเพื่อเปิดคลังเกมของคุณ</p>
        <ul class="tier-strip" id="tierStrip" aria-label="ระดับสมาชิก"></ul>
      </div>
      <div class="auth-card card">
        <div class="tabs" role="tablist" aria-label="เลือกการเข้าใช้งาน">
          <a role="tab" class="tab" href="#/login" aria-selected="${tab === 'login'}">เข้าสู่ระบบ</a>
          <a role="tab" class="tab" href="#/register" aria-selected="${tab === 'register'}">สมัครสมาชิก</a>
        </div>
        ${tab === 'login' ? login : register}
      </div>
    </section>`;

  sb.from('membership_tiers').select('code,name_th,price_monthly').order('rank').then(({ data }) => {
    const el = $('#tierStrip');
    if (el && data) el.innerHTML = data.map((t) => `<li class="t-${t.code}"><b>${esc(t.name_th)}</b><span>${priceText(t)}</span></li>`).join('');
  });

  const msg = $('#authMsg');
  if (tab === 'login') {
    $('#loginForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      withBusy(ev.submitter, async () => {
        if (!f.username.trim() || !f.password) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
        const { session } = await api('/api/login', { username: f.username.trim(), password: f.password });
        const { data, error } = await sb.auth.setSession(session);
        if (error) throw new Error('ไม่สามารถเริ่มเซสชันได้ กรุณาลองใหม่');
        state.session = data.session;
        resetUser();
        go('library');
      }, msg);
    });
  } else {
    $('#regForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const f = Object.fromEntries(new FormData(form));
      withBusy(ev.submitter, async () => {
        const username = f.username.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
        if (!USERNAME_RE.test(username)) throw new Error('ชื่อผู้ใช้ต้องมี 3–20 ตัว ใช้ได้เฉพาะ a-z, 0-9 และ _');
        if (!f.display_name.trim()) throw new Error('กรุณากรอกชื่อที่แสดง');
        const pe = pwProblem(f.password); if (pe) throw new Error(pe);
        if (f.password !== f.confirm) throw new Error('รหัสผ่านยืนยันไม่ตรงกัน');
        if (!f.agree) throw new Error('กรุณายอมรับเงื่อนไขการใช้งาน');
        const r = await api('/api/register', { email: f.email.trim(), username, display_name: f.display_name.trim(), password: f.password });
        form.reset();
        msg.textContent = r.message;
        msg.className = 'form-msg ok';
      }, msg);
    });
  }
}

function renderGate() {
  const p = state.profile;
  const map = {
    pending: ['บัญชีของคุณกำลังรอการอนุมัติ', 'GM จะตรวจสอบและกำหนดระดับสมาชิกให้คุณโดยเร็ว เมื่ออนุมัติแล้วคุณจะเข้าคลังเกมได้ทันที'],
    rejected: ['คำขอสมัครสมาชิกไม่ได้รับการอนุมัติ', 'หากคิดว่าเกิดความผิดพลาด กรุณาติดต่อ GM'],
    suspended: ['บัญชีของคุณถูกระงับชั่วคราว', 'ระหว่างนี้คุณไม่สามารถเข้าคลังเกมหรือเล่นเกมได้ กรุณาติดต่อ GM'],
  };
  const [title, body] = map[p.status] || ['ไม่สามารถเข้าใช้งานได้', 'กรุณาติดต่อ GM'];
  main().innerHTML = `
    <section class="card center-card" aria-live="polite">
      ${logo()}
      <span class="st st-${esc(p.status)}">${STATUS_TH[p.status] || p.status}</span>
      <h1>${title}</h1>
      <p class="muted">${body}</p>
      ${p.status_reason ? `<p class="note card">${icon('info')} เหตุผล: ${esc(p.status_reason)}</p>` : ''}
      <div class="row-end" style="justify-content:center;margin-top:16px">
        <button class="btn primary" id="recheck">ตรวจสอบสถานะอีกครั้ง</button>
        <button class="btn ghost" id="gateOut">ออกจากระบบ</button>
      </div>
    </section>`;
  $('#recheck').onclick = (e) => withBusy(e.currentTarget, async () => {
    state.profile = null; await route();
    if (state.profile?.status === 'active') toast('บัญชีของคุณเปิดใช้งานแล้ว ยินดีต้อนรับ!');
  });
  $('#gateOut').onclick = logout;
}

function renderChangePassword(forced) {
  main().innerHTML = `
    <section class="card center-card">
      ${forced ? logo() : ''}
      <h1>${forced ? 'ตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน' : 'เปลี่ยนรหัสผ่าน'}</h1>
      <p class="muted">${forced ? 'เพื่อความปลอดภัย บัญชีนี้ต้องเปลี่ยนรหัสผ่านเริ่มต้นก่อนเข้าใช้งาน' : 'กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่ของคุณ'}</p>
      <form id="pwForm" class="form" novalidate>
        <label>รหัสผ่านปัจจุบัน<input type="password" name="current" autocomplete="current-password" required></label>
        <label>รหัสผ่านใหม่<input type="password" name="next" autocomplete="new-password" required minlength="8"></label>
        <label>ยืนยันรหัสผ่านใหม่<input type="password" name="confirm" autocomplete="new-password" required></label>
        <p class="hint">อย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข</p>
        <p class="form-msg" id="pwMsg" role="alert"></p>
        <button class="btn primary block" type="submit">บันทึกรหัสผ่านใหม่</button>
        ${forced ? '<button type="button" class="btn ghost block" id="pwOut">ออกจากระบบ</button>' : '<a class="btn ghost block" href="#/account">ยกเลิก</a>'}
      </form>
    </section>`;
  $('#pwOut')?.addEventListener('click', logout);
  $('#pwForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    withBusy(ev.submitter, async () => {
      if (!f.current) throw new Error('กรุณากรอกรหัสผ่านปัจจุบัน');
      const pe = pwProblem(f.next); if (pe) throw new Error(pe);
      if (f.next !== f.confirm) throw new Error('รหัสผ่านยืนยันไม่ตรงกัน');
      await api('/api/change-password', { current_password: f.current, new_password: f.next }, true);
      toast('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
      state.profile = null;
      go('library');
    }, $('#pwMsg'));
  });
}

// ---------------------------------------------------------------- library
const MODES = [
  { key: 'single', label: '👤 Single player' },
  { key: 'duo', label: '👥 Duo player' },
  { key: 'multi', label: '🎮 Multiple player' },
];
const modeChips = (list) => MODES.filter((m) => (list || []).includes(m.key))
  .map((m) => `<span class="tag">${m.label}</span>`).join('');
const gameCard = (g) => `
  <a class="gcard ${g.can_play ? '' : 'locked'}" href="#/game/${g.id}"
     aria-label="${esc(g.title)} — ${g.can_play ? 'พร้อมเล่น' : `ล็อก ระดับแนะนำ ${TIER_LABEL[g.min_tier]}`}">
    <div class="thumb">
      ${g.thumbnail_url ? `<img src="${esc(g.thumbnail_url)}" alt="" loading="lazy">` : `<div class="thumb-ph">${icon(g.category_icon)}</div>`}
      ${tierBadge(g.min_tier)}
      ${g.can_play ? '' : `<span class="lock">${icon('lock')}</span>`}
      ${g.is_published === false ? '<span class="tag warn draft">ฉบับร่าง</span>' : ''}
    </div>
    <div class="gbody">
      <h3>${esc(g.title)}</h3>
      <p class="cat">${esc(g.category_name || 'ไม่มีหมวดหมู่')}</p>
      ${(g.modes || []).length ? `<div class="tags">${modeChips(g.modes)}</div>` : ''}
      <p class="desc">${esc(g.short_description)}</p>
      <span class="access ${g.can_play ? 'ok' : 'no'}">${g.can_play ? 'พร้อมเล่น' : `ล็อก · ระดับ ${TIER_LABEL[g.min_tier]} ขึ้นไป`}</span>
    </div>
  </a>`;

const carousel = (title, list, id) => `
  <section class="block" aria-labelledby="${id}H">
    <div class="block-head"><h2 id="${id}H">${title}</h2>
      <div class="car-nav">
        <button class="icon-btn" data-car="${id}" data-dir="-1" aria-label="เลื่อนไปทางซ้าย">‹</button>
        <button class="icon-btn" data-car="${id}" data-dir="1" aria-label="เลื่อนไปทางขวา">›</button>
      </div></div>
    <div class="carousel" id="car-${id}">${list.map(gameCard).join('')}</div>
  </section>`;

function filteredGames() {
  const { q: query, cat, access, sort } = state.f;
  const needle = query.trim().toLowerCase();
  const list = state.library.filter((g) =>
    (cat === 'all' || g.category_id === cat)
    && (access === 'all' || (access === 'open' ? g.can_play : !g.can_play))
    && (!needle || [g.title, g.short_description, g.category_name].some((s) => (s || '').toLowerCase().includes(needle))));
  if (sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title, 'th'));
  else if (sort === 'tier') list.sort((a, b) => tierRank(a.min_tier) - tierRank(b.min_tier));
  return list;
}

function drawGrid() {
  const list = filteredGames();
  $('#grid').innerHTML = list.length ? list.map(gameCard).join('')
    : `<div class="empty">${icon('search')}<p>ไม่พบเกมที่ตรงกับการค้นหา</p></div>`;
  $('#countLbl').textContent = `${list.length} เกม`;
}

function membershipLine() {
  const m = state.membership;
  if (!state.tier) return 'สมาชิกภาพของคุณไม่ได้ใช้งานอยู่ กรุณาติดต่อ GM';
  if (m?.expires_at) return `หมดอายุ ${fmtDate(m.expires_at)}`;
  return 'ไม่มีวันหมดอายุ';
}

async function renderLibrary() {
  main().innerHTML = loading();
  let lib, cats;
  try {
    [lib, cats] = await Promise.all([
      q(sb.rpc('get_library')),
      q(sb.from('categories').select('*').eq('is_active', true).order('sort_order')),
    ]);
  } catch (e) { main().innerHTML = errorBox(e.message); return; }
  state.library = lib || [];
  state.categories = cats || [];
  const p = state.profile;
  const playable = state.library.filter((g) => g.can_play).length;
  const featured = state.library.filter((g) => g.is_featured);
  const recent = state.library.slice(0, 10);
  const count = (id) => state.library.filter((g) => g.category_id === id).length;

  main().innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">AORTICA GAME CENTER</p>
        <h1 class="hero-title">สวัสดี, <span class="grad">${esc(p.display_name || p.username)}</span></h1>
        <p class="lead">รวมทุกความสนุก ไว้ในที่เดียว — คุณเล่นได้ <b>${playable}</b> จาก ${state.library.length} เกม</p>
        <form class="search" role="search" id="heroSearch">
          ${icon('search')}
          <label class="sr" for="q">ค้นหาเกม</label>
          <input id="q" type="search" placeholder="ค้นหาชื่อเกม หรือหมวดหมู่..." value="${esc(state.f.q)}" autocomplete="off" enterkeyhint="search">
          <button class="btn primary sm" type="submit">ค้นหา</button>
        </form>
      </div>
      <div class="hero-side card">
        <span class="muted small">ระดับสมาชิกของคุณ</span>
        ${tierBadge(state.tier, 'lg')}
        <span class="muted small">${membershipLine()}</span>
        <a class="btn ghost sm" href="#/membership">ดูสิทธิ์ทั้งหมด</a>
      </div>
    </section>
    ${state.library.length === 0 ? `<section class="card empty">${icon('all')}<p>ยังไม่มีเกมในคลัง</p>${isGM() ? '<a class="btn primary sm" href="#/gm/games">เพิ่มเกมแรก</a>' : ''}</section>` : `
    ${featured.length ? carousel('เกมแนะนำ', featured, 'feat') : ''}
    ${carousel('เพิ่มล่าสุด', recent, 'recent')}
    <section class="block" id="allGames" aria-labelledby="allH">
      <div class="block-head"><h2 id="allH">คลังเกมทั้งหมด</h2><span class="muted" id="countLbl"></span></div>
      <div class="chips" id="cats" role="group" aria-label="กรองตามหมวดหมู่">
        <button class="chip" data-cat="all" aria-pressed="${state.f.cat === 'all'}">${icon('all')} ทั้งหมด <small>${state.library.length}</small></button>
        ${state.categories.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${state.f.cat === c.id}">${icon(c.icon)} ${esc(c.name_th)} <small>${count(c.id)}</small></button>`).join('')}
      </div>
      <div class="filters">
        <label>สิทธิ์การเข้าถึง
          <select id="fAccess">
            <option value="all">ทั้งหมด</option><option value="open">เล่นได้</option><option value="locked">ล็อกอยู่</option>
          </select></label>
        <label>เรียงตาม
          <select id="fSort">
            <option value="new">เพิ่มล่าสุด</option><option value="az">ชื่อ ก–ฮ / A–Z</option><option value="tier">ระดับสมาชิก</option>
          </select></label>
      </div>
      <div class="grid" id="grid" aria-live="polite"></div>
    </section>`}`;

  if (!state.library.length) return;
  $('#fAccess').value = state.f.access;
  $('#fSort').value = state.f.sort;
  $('#q').addEventListener('input', (e) => { state.f.q = e.target.value; drawGrid(); });
  $('#heroSearch').addEventListener('submit', (e) => { e.preventDefault(); $('#allGames').scrollIntoView({ behavior: 'smooth' }); });
  $('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    state.f.cat = b.dataset.cat;
    $$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawGrid();
  });
  $('#fAccess').onchange = (e) => { state.f.access = e.target.value; drawGrid(); };
  $('#fSort').onchange = (e) => { state.f.sort = e.target.value; drawGrid(); };
  $$('[data-car]').forEach((b) => {
    b.onclick = () => { const c = $(`#car-${b.dataset.car}`); c.scrollBy({ left: c.clientWidth * 0.8 * Number(b.dataset.dir), behavior: 'smooth' }); };
  });
  drawGrid();
}

// ---------------------------------------------------------------- game detail & player
async function renderGame(id) {
  main().innerHTML = loading();
  try {
    const [g, can] = await Promise.all([
      q(sb.from('games').select('*, categories(name_th, icon)').eq('id', id).maybeSingle()),
      q(sb.rpc('can_access_game', { p_game: id })),
    ]);
    if (!g) throw new Error('ไม่พบเกมนี้ หรือคุณไม่มีสิทธิ์ดูข้อมูล');
    const cat = one(g.categories);
    const shots = (Array.isArray(g.screenshots) ? g.screenshots : []).filter((u) => /^https:\/\//.test(u));
    main().innerHTML = `
      <nav class="crumbs" aria-label="เส้นทาง"><a href="#/library">คลังเกม</a><span aria-hidden="true">/</span><span>${esc(g.title)}</span></nav>
      <article class="detail">
        <div class="detail-media">${g.thumbnail_url ? `<img src="${esc(g.thumbnail_url)}" alt="ภาพปกเกม ${esc(g.title)}">` : `<div class="thumb-ph big">${icon(cat?.icon)}</div>`}</div>
        <div class="detail-info card">
        <div class="tags"><span class="tag">${esc(cat?.name_th || 'ไม่มีหมวดหมู่')}</span>${tierBadge(g.min_tier)}${modeChips(g.modes)}${g.is_published ? '' : '<span class="tag warn">ยังไม่เผยแพร่</span>'}</div>
          <h1>${esc(g.title)}</h1>
          <p class="lead">${esc(g.short_description)}</p>
          ${can ? `<a class="btn primary xl" href="#/play/${g.id}">${icon('play')} เล่นเกม</a>` : `
            <div class="locked-panel">${icon('lock')}<div>
              <b>เกมนี้ยังไม่เปิดสำหรับระดับสมาชิกของคุณ</b>
              <p>ระดับที่แนะนำ: ${TIER_LABEL[g.min_tier]} ขึ้นไป — ติดต่อ GM เพื่ออัปเกรดหรือต่ออายุสมาชิก</p>
              <a class="btn ghost sm" href="#/membership">ดูระดับสมาชิก</a></div></div>`}
          <dl class="meta">
            <div><dt>ระดับขั้นต่ำ</dt><dd>${TIER_LABEL[g.min_tier]}</dd></div>
            <div><dt>สิทธิ์ของคุณ</dt><dd>${can ? '<span class="ok">เล่นได้</span>' : '<span class="no">ล็อก</span>'}</dd></div>
            <div><dt>เพิ่มเมื่อ</dt><dd>${fmtDate(g.created_at)}</dd></div>
          </dl>
        </div>
      </article>
      ${g.description ? `<section class="block card prose"><h2>รายละเอียดเกม</h2><p>${esc(g.description).replace(/\n/g, '<br>')}</p></section>` : ''}
      ${shots.length ? `<section class="block"><h2>ภาพหน้าจอ</h2><div class="shots">${shots.map((u) => `<img src="${esc(u)}" alt="ภาพหน้าจอ ${esc(g.title)}" loading="lazy">`).join('')}</div></section>` : ''}`;
  } catch (e) { main().innerHTML = errorBox(e.message, '#/library'); }
}

async function renderPlay(id) {
  main().innerHTML = loading();
  try {
    const [url, g] = await Promise.all([
      q(sb.rpc('get_play_url', { p_game: id })),
      q(sb.from('games').select('title').eq('id', id).maybeSingle()),
    ]);
    if (!/^https:\/\//.test(url || '')) throw new Error(ERR_TH.NO_SOURCE);
    const title = g?.title || 'เกม';
    main().innerHTML = `
      <section class="player">
        <div class="player-bar">
          <a class="btn ghost sm" href="#/game/${esc(id)}">‹ กลับ</a>
          <strong>${esc(title)}</strong>
          <button class="btn ghost sm" id="fsBtn">เต็มจอ</button>
          <a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">เปิดในแท็บใหม่</a>
        </div>
        <iframe id="frame" src="${esc(url)}" title="${esc(title)}" allow="fullscreen; gamepad; autoplay"
          allowfullscreen referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups"></iframe>
      </section>`;
    $('#fsBtn').onclick = () => $('#frame').requestFullscreen?.().catch(() => toast('อุปกรณ์นี้ไม่รองรับโหมดเต็มจอ', 'err'));
  } catch (e) { main().innerHTML = errorBox(e.message, `#/game/${encodeURIComponent(id)}`); }
}

// ---------------------------------------------------------------- membership & account
function renderMembership() {
  const cur = state.tier;
  main().innerHTML = `
    <section class="block">
      <p class="eyebrow">MEMBERSHIP</p>
      <h1 class="page-title">ระบบสมาชิก 4 ระดับ</h1>
      <p class="lead">ระดับที่สูงกว่าได้รับสิทธิ์ของระดับที่ต่ำกว่าโดยอัตโนมัติ และ GM สามารถกำหนดข้อยกเว้นรายเกมได้</p>
      <div class="tiers">
        ${state.tiers.map((t) => `
          <article class="tier-card t-${t.code} ${t.code === cur ? 'current' : ''} ${t.is_active ? '' : 'off'}">
            <header><h2>${esc(t.name_th)}</h2>${t.code === cur ? '<span class="tag">ระดับของคุณ</span>' : ''}</header>
            <p class="price">${priceText(t)}</p>
            <p class="muted">${esc(t.description_th)}</p>
            <ul>${(t.benefits || []).map((b) => `<li>${icon('check')}<span>${esc(b)}</span></li>`).join('')}</ul>
            ${t.is_active ? '' : '<p class="tag warn">ปิดให้บริการชั่วคราว</p>'}
          </article>`).join('')}
      </div>
      <p class="note card">${icon('info')} ขณะนี้ยังไม่เปิดชำระเงินออนไลน์ หากต้องการอัปเกรดหรือต่ออายุสมาชิก กรุณาติดต่อ GM</p>
    </section>`;
}

async function renderAccount() {
  const p = state.profile;
  const m = state.membership || {};
  if (!state.library.length) { try { state.library = await q(sb.rpc('get_library')) || []; } catch { /* non-critical */ } }
  const playable = state.library.filter((g) => g.can_play).length;
  const expired = m.expires_at && new Date(m.expires_at) <= new Date();
  main().innerHTML = `
    <section class="block">
      <h1 class="page-title">บัญชีของฉัน</h1>
      <div class="dash">
        <article class="card profile-card">
          <span class="avatar xl" aria-hidden="true">${esc((p.display_name || p.username).charAt(0).toUpperCase())}</span>
          <div><h2>${esc(p.display_name || p.username)}</h2>
            <p class="muted small">@${esc(p.username)} · ${esc(p.email)}</p>
            ${tierBadge(state.tier, 'lg')}${p.role === 'gm' ? ' <span class="tag">GameMaster</span>' : ''}</div>
        </article>
        <article class="card">
          <h2>สิทธิ์การเข้าถึง</h2>
          <p class="big-num">${playable}<small>จาก ${state.library.length} เกม</small></p>
          <a class="btn ghost sm" href="#/library">ไปที่คลังเกม</a>
        </article>
        <article class="card">
          <h2>สถานะสมาชิกภาพ</h2>
          <dl class="meta col">
            <div><dt>ระดับที่บันทึกไว้</dt><dd>${TIER_LABEL[m.tier_code] || '—'}</dd></div>
            <div><dt>ระดับที่ใช้งานจริง</dt><dd>${state.tier ? TIER_LABEL[state.tier] : 'ไม่มีสิทธิ์'}</dd></div>
            <div><dt>สถานะ</dt><dd>${expired ? 'หมดอายุ' : MS_TH[m.status] || '—'}</dd></div>
            <div><dt>วันที่เริ่ม</dt><dd>${fmtDate(m.started_at)}</dd></div>
            <div><dt>วันหมดอายุ</dt><dd>${m.expires_at ? fmtDate(m.expires_at) : 'ไม่มีวันหมดอายุ'}</dd></div>
            <div><dt>ต่ออายุล่าสุด</dt><dd>${fmtDate(m.last_renewed_at)}</dd></div>
          </dl>
          ${expired ? `<p class="note">${icon('info')} สมาชิกภาพหมดอายุแล้ว สิทธิ์ของคุณถูกปรับตามนโยบายของ GM กรุณาติดต่อ GM เพื่อต่ออายุ</p>` : ''}
        </article>
        <article class="card">
          <h2>ตั้งค่าบัญชี</h2>
          <form id="nameForm" class="form">
            <label>ชื่อที่แสดง<input name="display_name" maxlength="50" required value="${esc(p.display_name)}"></label>
            <p class="form-msg" id="nameMsg" role="alert"></p>
            <div class="row"><button class="btn primary sm" type="submit">บันทึกชื่อ</button>
              <a class="btn ghost sm" href="#/password">เปลี่ยนรหัสผ่าน</a>
              <button class="btn danger sm" type="button" id="accOut">ออกจากระบบ</button></div>
          </form>
        </article>
      </div>
    </section>`;
  $('#accOut').onclick = logout;
  $('#nameForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = new FormData(ev.target).get('display_name').trim();
    withBusy(ev.submitter, async () => {
      if (!name) throw new Error('กรุณากรอกชื่อที่แสดง');
      await q(sb.rpc('update_my_profile', { p_display_name: name }));
      state.profile.display_name = name;
      chrome(true, 'account');
      toast('บันทึกชื่อเรียบร้อย');
    }, $('#nameMsg'));
  });
}

// ---------------------------------------------------------------- GM control center
const GM_TABS = [['overview', 'ภาพรวม'], ['users', 'สมาชิก'], ['games', 'จัดการเกม'], ['categories', 'หมวดหมู่'],
  ['tiers', 'ระดับสมาชิก'], ['settings', 'ตั้งค่าระบบ'], ['logs', 'บันทึกกิจกรรม']];

async function renderGM(tab) {
  if (!GM_VIEWS[tab]) tab = 'overview';
  main().innerHTML = `
    <section>
      <div class="gm-head"><div><p class="eyebrow">GM CONTROL CENTER</p><h1>ศูนย์ควบคุมผู้ดูแลระบบ</h1></div></div>
      <nav class="gm-tabs" aria-label="เมนูผู้ดูแลระบบ">
        ${GM_TABS.map(([k, l]) => `<a href="#/gm/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
      </nav>
      <div id="gmBody">${loading()}</div>
    </section>`;
  try { await GM_VIEWS[tab]($('#gmBody')); }
  catch (e) { $('#gmBody').innerHTML = errorBox(e.message); }
}
const rerenderGM = (tab) => { state.library = []; renderGM(tab); };
const actBtn = (act, label, kind = 'ghost') => `<button class="btn ${kind} xs" data-act="${act}">${label}</button>`;
const tierOptions = (sel) => TIERS.map((t) => `<option value="${t}" ${sel === t ? 'selected' : ''}>${TIER_LABEL[t]}</option>`).join('');

const GM_VIEWS = {
  async overview(el) {
    const head = { count: 'exact', head: true };
    const [total, pending, active, suspended, games, published, ms] = await Promise.all([
      qc(sb.from('profiles').select('id', head)),
      qc(sb.from('profiles').select('id', head).eq('status', 'pending')),
      qc(sb.from('profiles').select('id', head).eq('status', 'active')),
      qc(sb.from('profiles').select('id', head).eq('status', 'suspended')),
      qc(sb.from('games').select('id', head)),
      qc(sb.from('games').select('id', head).eq('is_published', true)),
      q(sb.from('memberships').select('tier_code')),
    ]);
    const byTier = Object.fromEntries(TIERS.map((t) => [t, ms.filter((m) => m.tier_code === t).length]));
    el.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${total}</b><span>ผู้ใช้ทั้งหมด</span></div>
        <div class="stat"><b class="no">${pending}</b><span>รออนุมัติ</span></div>
        <div class="stat"><b class="ok">${active}</b><span>ใช้งานอยู่</span></div>
        <div class="stat"><b>${suspended}</b><span>ถูกระงับ</span></div>
        <div class="stat"><b>${published}<small class="muted"> / ${games}</small></b><span>เกมที่เผยแพร่</span></div>
      </div>
      <div class="stats">${TIERS.map((t) => `<div class="stat">${tierBadge(t)}<b>${byTier[t]}</b><span>สมาชิก</span></div>`).join('')}</div>
      <div class="row">
        <a class="btn primary" href="#/gm/users">ตรวจสอบผู้สมัคร (${pending})</a>
        <a class="btn ghost" href="#/gm/games">${icon('plus')} จัดการเกม</a>
      </div>`;
  },

  async users(el) {
    const f = state.gmUserFilter;
    let query = sb.from('profiles').select('*, memberships!memberships_user_id_fkey(*)').order('created_at', { ascending: false }).limit(300);
    if (f !== 'all') query = query.eq('status', f);
    const rows = await q(query);
    const filters = [['pending', 'รออนุมัติ'], ['active', 'ใช้งานอยู่'], ['suspended', 'ถูกระงับ'], ['rejected', 'ถูกปฏิเสธ'], ['all', 'ทั้งหมด']];
    const row = (u) => {
      const m = one(u.memberships) || {};
      const self = u.id === state.profile.id;
      const acts = self ? '<span class="muted small">บัญชีของคุณ</span>' : ({
        pending: actBtn('approve', 'อนุมัติ', 'primary') + actBtn('reject', 'ปฏิเสธ', 'danger'),
        active: actBtn('membership', 'สมาชิกภาพ') + actBtn('suspend', 'ระงับ', 'danger'),
        suspended: actBtn('reactivate', 'เปิดใช้งาน', 'primary') + actBtn('membership', 'สมาชิกภาพ'),
        rejected: actBtn('approve', 'อนุมัติ', 'primary'),
      }[u.status] || '');
      const expired = m.expires_at && new Date(m.expires_at) <= new Date();
      return `<tr data-id="${u.id}" data-s="${esc(`${u.username} ${u.email} ${u.display_name}`.toLowerCase())}">
        <td><b>${esc(u.username)}</b>${u.role === 'gm' ? ' <span class="tag">GM</span>' : ''}<br><span class="muted small">${esc(u.display_name)}</span></td>
        <td>${esc(u.email)}</td>
        <td><span class="st st-${u.status}">${STATUS_TH[u.status]}</span>${u.status_reason ? `<br><span class="muted small">${esc(u.status_reason)}</span>` : ''}</td>
        <td>${tierBadge(m.tier_code)}<br><span class="muted small">${expired ? 'หมดอายุ' : MS_TH[m.status] || ''}</span></td>
        <td>${m.expires_at ? fmtDate(m.expires_at) : 'ไม่มี'}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td><div class="actions">${acts}</div></td></tr>`;
    };
    el.innerHTML = `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="กรองสถานะ">${filters.map(([k, l]) => `<button data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
        <input type="search" id="uq" placeholder="ค้นหาชื่อผู้ใช้หรืออีเมล" aria-label="ค้นหาผู้ใช้">
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>ผู้ใช้</th><th>อีเมล</th><th>สถานะบัญชี</th><th>ระดับ</th><th>หมดอายุ</th><th>สมัครเมื่อ</th><th>การจัดการ</th></tr></thead>
        <tbody>${rows.map(row).join('') || '<tr><td colspan="7" class="muted">ไม่มีรายการ</td></tr>'}</tbody>
      </table></div>`;

    $$('[data-f]', el).forEach((b) => { b.onclick = () => { state.gmUserFilter = b.dataset.f; renderGM('users'); }; });
    $('#uq', el).addEventListener('input', (e) => {
      const s = e.target.value.trim().toLowerCase();
    $$('tbody tr[data-id]', el).forEach((tr) => { tr.hidden = !!s && !tr.dataset.s.includes(s); });
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const u = rows.find((r) => r.id === b.closest('tr').dataset.id); if (!u) return;
      const act = b.dataset.act;
      if (act === 'approve') membershipModal(u, 'approve');
      else if (act === 'membership') membershipModal(u, 'edit');
      else if (act === 'reject' || act === 'suspend') reasonModal(u, act);
      else if (act === 'reactivate') confirmModal('เปิดใช้งานบัญชีอีกครั้ง', `ยืนยันการเปิดใช้งานบัญชี ${u.username}?`, async () => {
        await q(sb.rpc('gm_review_user', { p_user: u.id, p_action: 'reactivate' }));
        toast('เปิดใช้งานบัญชีแล้ว'); renderGM('users');
      }, false);
    });
  },

  async games(el) {
    const games = await q(sb.from('games').select('*, categories(name_th)').order('created_at', { ascending: false }));
    el.innerHTML = `
      <div class="toolbar"><span class="muted">${games.length} เกม</span>
        <input type="search" id="gq" placeholder="ค้นหาชื่อเกม, slug หรือหมวดหมู่" aria-label="ค้นหาเกม">
        <button class="btn primary sm" id="addGame">${icon('plus')} เพิ่มเกม</button></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>ชื่อเกม</th><th>หมวดหมู่</th><th>ระดับขั้นต่ำ</th><th>สถานะ</th><th>แนะนำ</th><th>อัปเดต</th><th>การจัดการ</th></tr></thead>
          <tbody>${games.map((g) => `<tr data-id="${g.id}" data-s="${esc(`${g.title} ${g.slug} ${one(g.categories)?.name_th || ''}`.toLowerCase())}">
          <td><b>${esc(g.title)}</b><br><span class="muted small">${esc(g.slug)}</span></td>
          <td>${esc(one(g.categories)?.name_th || '—')}</td>
          <td>${tierBadge(g.min_tier)}</td>
          <td>${g.is_published ? '<span class="st st-active">เผยแพร่แล้ว</span>' : '<span class="st st-pending">ฉบับร่าง</span>'}</td>
          <td>${g.is_featured ? '★' : '—'}</td>
          <td>${fmtDate(g.updated_at)}</td>
          <td><div class="actions">${actBtn('edit', 'แก้ไข')}${actBtn('view', 'ดูหน้าเกม')}${actBtn('del', 'ลบ', 'danger')}</div></td>
        </tr>`).join('') || '<tr><td colspan="7" class="muted">ยังไม่มีเกม กด “เพิ่มเกม” เพื่อเริ่มต้น</td></tr>'}</tbody>
      </table></div>`;
    $('#addGame').onclick = () => gameModal(null);
    $('#gq', el).addEventListener('input', (e) => {
      const s = e.target.value.trim().toLowerCase();
      $$('tbody tr[data-id]', el).forEach((tr) => { tr.hidden = !!s && !tr.dataset.s.includes(s); });
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const g = games.find((x) => x.id === b.closest('tr').dataset.id); if (!g) return;
      if (b.dataset.act === 'edit') gameModal(g);
      else if (b.dataset.act === 'view') go(`game/${g.id}`);
      else confirmModal('ลบเกม', `ต้องการลบ “${g.title}” ถาวรหรือไม่? การลบไม่สามารถย้อนกลับได้`, async () => {
        await q(sb.from('games').delete().eq('id', g.id));
        toast('ลบเกมแล้ว'); rerenderGM('games');
      });
    });
  },

  async categories(el) {
    const cats = await q(sb.from('categories').select('*').order('sort_order'));
    el.innerHTML = `
      <div class="toolbar"><span class="muted">${cats.length} หมวดหมู่</span>
        <input type="search" id="cq" placeholder="ค้นหาหมวดหมู่" aria-label="ค้นหาหมวดหมู่">
        <button class="btn primary sm" id="addCat">${icon('plus')} เพิ่มหมวดหมู่</button></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>ไอคอน</th><th>ชื่อ</th><th>Slug</th><th>ลำดับ</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
        <tbody>${cats.map((c) => `<tr data-id="${c.id}" data-s="${esc(`${c.name_th} ${c.slug}`.toLowerCase())}">
          <td>${icon(c.icon)}</td><td><b>${esc(c.name_th)}</b></td><td>${esc(c.slug)}</td><td>${c.sort_order}</td>
          <td>${c.is_active ? '<span class="st st-active">แสดง</span>' : '<span class="st st-pending">ซ่อน</span>'}</td>
          <td><div class="actions">${actBtn('edit', 'แก้ไข')}${actBtn('del', 'ลบ', 'danger')}</div></td></tr>`).join('')}</tbody>
      </table></div>`;
    $('#addCat').onclick = () => categoryModal(null);
    $('#cq', el).addEventListener('input', (e) => {
      const s = e.target.value.trim().toLowerCase();
      $$('tbody tr[data-id]', el).forEach((tr) => { tr.hidden = !!s && !tr.dataset.s.includes(s); });
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const c = cats.find((x) => x.id === b.closest('tr').dataset.id); if (!c) return;
      if (b.dataset.act === 'edit') categoryModal(c);
      else confirmModal('ลบหมวดหมู่', `ลบ “${c.name_th}”? เกมในหมวดนี้จะกลายเป็น “ไม่มีหมวดหมู่”`, async () => {
        await q(sb.from('categories').delete().eq('id', c.id));
        toast('ลบหมวดหมู่แล้ว'); rerenderGM('categories');
      });
    });
  },

  async tiers(el) {
    const tiers = await q(sb.from('membership_tiers').select('*').order('rank'));
    el.innerHTML = `
      <p class="muted">ราคาเว้นว่าง = ยังไม่กำหนดราคา (ระบบยังไม่มีการเรียกเก็บเงิน) · ระดับที่สูงกว่าได้รับสิทธิ์ของระดับที่ต่ำกว่าโดยอัตโนมัติ</p>
      <div class="tier-forms">${tiers.map((t) => `
        <form class="card form" data-code="${t.code}">
          <h2>${tierBadge(t.code, 'lg')}</h2>
          <label>ชื่อที่แสดง<input name="name_th" required maxlength="30" value="${esc(t.name_th)}"></label>
          <label>คำอธิบาย<textarea name="description_th" rows="2" maxlength="300">${esc(t.description_th)}</textarea></label>
          <div class="cols">
            <label>ราคาต่อเดือน<input name="price_monthly" type="number" min="0" step="0.01" value="${t.price_monthly ?? ''}" placeholder="ยังไม่กำหนด"></label>
            <label>สกุลเงิน<input name="currency" maxlength="3" value="${esc(t.currency)}"></label>
          </div>
          <label>สิทธิประโยชน์ (บรรทัดละ 1 ข้อ)<textarea name="benefits" rows="3">${esc((t.benefits || []).join('\n'))}</textarea></label>
          <label class="check"><input type="checkbox" name="is_active" ${t.is_active ? 'checked' : ''}> เปิดใช้งานระดับนี้</label>
          <p class="form-msg" role="alert"></p>
          <button class="btn primary sm" type="submit">บันทึก ${TIER_LABEL[t.code]}</button>
        </form>`).join('')}</div>`;
    $$('form[data-code]', el).forEach((form) => form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      withBusy(ev.submitter, async () => {
        const price = f.price_monthly === '' ? null : Number(f.price_monthly);
        if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error('ราคาไม่ถูกต้อง');
        await q(sb.from('membership_tiers').update({
          name_th: f.name_th.trim(), description_th: f.description_th.trim(), price_monthly: price,
          currency: (f.currency || 'THB').trim().toUpperCase(),
          benefits: f.benefits.split('\n').map((s) => s.trim()).filter(Boolean), is_active: !!f.is_active,
        }).eq('code', form.dataset.code));
        toast('บันทึกระดับสมาชิกแล้ว');
        state.profile = null;   // refresh cached tiers on next navigation
      }, $('.form-msg', form));
    }));
  },

  async settings(el) {
    const rows = await q(sb.from('platform_settings').select('*'));
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    el.innerHTML = `
      <form class="card form" id="setForm" style="max-width:560px">
        <h2>ตั้งค่าระบบ</h2>
        <label class="check"><input type="checkbox" name="registration_open" ${s.registration_open !== false ? 'checked' : ''}> เปิดรับสมัครสมาชิกใหม่</label>
        <label>เมื่อสมาชิกภาพหมดอายุ ให้สิทธิ์เป็น
          <select name="expired_fallback_tier">
            <option value="normal" ${s.expired_fallback_tier !== 'none' ? 'selected' : ''}>ลดเป็น Normal (เล่นเกมระดับ Normal ได้)</option>
            <option value="none" ${s.expired_fallback_tier === 'none' ? 'selected' : ''}>ไม่มีสิทธิ์เล่นเกมจนกว่าจะต่ออายุ</option>
          </select></label>
        <p class="form-msg" id="setMsg" role="alert"></p>
        <button class="btn primary" type="submit">บันทึกการตั้งค่า</button>
      </form>`;
    $('#setForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      withBusy(ev.submitter, async () => {
        await q(sb.from('platform_settings').upsert([
          { key: 'registration_open', value: !!f.registration_open },
          { key: 'expired_fallback_tier', value: f.expired_fallback_tier },
        ]));
        toast('บันทึกการตั้งค่าแล้ว');
      }, $('#setMsg'));
    });
  },

  async logs(el) {
    const logs = await q(sb.from('audit_logs').select('*, profiles(username)').order('created_at', { ascending: false }).limit(150));
    el.innerHTML = `
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>การกระทำ</th><th>ตาราง</th><th>รหัสเป้าหมาย</th></tr></thead>
        <tbody>${logs.map((l) => `<tr>
          <td>${fmtDateTime(l.created_at)}</td><td>${esc(one(l.profiles)?.username || 'ระบบ')}</td>
          <td><code>${esc(l.action)}</code></td><td>${esc(l.target_table || '—')}</td>
          <td class="muted small">${esc(String(l.target_id || '').slice(0, 12))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">ยังไม่มีบันทึก</td></tr>'}</tbody>
      </table></div>`;
  },
};

function membershipModal(u, mode) {
  const m = one(u.memberships) || {};
  const approve = mode === 'approve';
  openModal(`
    <form id="mf" class="form" novalidate>
      <h2>${approve ? 'อนุมัติสมาชิก' : 'จัดการสมาชิกภาพ'}: ${esc(u.username)}</h2>
      <p class="muted small">${esc(u.email)}</p>
      <div class="cols">
        <label>ระดับสมาชิก<select name="tier" required>${tierOptions(m.tier_code || 'normal')}</select></label>
        ${approve ? '' : `<label>สถานะสมาชิกภาพ<select name="status">${Object.entries(MS_TH).map(([k, l]) => `<option value="${k}" ${m.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
        ${approve ? '' : `<label>วันที่เริ่ม<input type="date" name="start" value="${toDateInput(m.started_at)}"></label>`}
        <label>วันหมดอายุ (เว้นว่าง = ไม่มีวันหมดอายุ)<input type="date" name="expires" value="${approve ? '' : toDateInput(m.expires_at)}"></label>
      </div>
      <div class="row"><span class="muted small">ต่ออายุด่วน:</span>
        <button type="button" class="btn ghost xs" data-add="30">+30 วัน</button>
        <button type="button" class="btn ghost xs" data-add="90">+90 วัน</button>
        <button type="button" class="btn ghost xs" data-add="365">+1 ปี</button>
        <button type="button" class="btn ghost xs" data-add="0">ไม่มีวันหมดอายุ</button></div>
      ${approve ? '' : '<label>หมายเหตุการต่ออายุ / เปลี่ยนแปลง<input name="note" maxlength="200"></label>'}
      <p class="form-msg" id="mfMsg" role="alert"></p>
      <div class="row-end"><button type="button" class="btn ghost" data-close>ยกเลิก</button>
        <button class="btn primary" type="submit">${approve ? 'อนุมัติและเปิดใช้งาน' : 'บันทึก'}</button></div>
    </form>`, (d) => {
    const exp = $('[name=expires]', d);
      $$('[data-add]', d).forEach((b) => { b.onclick = () => {
      const days = Number(b.dataset.add);
      if (!days) { exp.value = ''; return; }
      const base = exp.value && new Date(exp.value) > new Date() ? new Date(exp.value) : new Date();
      base.setDate(base.getDate() + days);
      exp.value = base.toISOString().slice(0, 10);
    }; });
    $('#mf', d).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      withBusy(ev.submitter, async () => {
        const expires = fromDateInput(f.expires, true);
        if (expires && new Date(expires) <= new Date() && approve) throw new Error('วันหมดอายุต้องเป็นวันในอนาคต');
        if (approve) {
          await q(sb.rpc('gm_review_user', { p_user: u.id, p_action: 'approve', p_tier: f.tier, p_expires: expires }));
          toast(`อนุมัติ ${u.username} เป็นระดับ ${TIER_LABEL[f.tier]} แล้ว`);
        } else {
          await q(sb.rpc('gm_set_membership', {
            p_user: u.id, p_tier: f.tier, p_status: f.status,
            p_started: fromDateInput(f.start), p_expires: expires, p_note: f.note || null,
          }));
          toast('บันทึกสมาชิกภาพแล้ว');
        }
        closeModal(); renderGM('users');
      }, $('#mfMsg', d));
    });
  });
}

function reasonModal(u, action) {
  const reject = action === 'reject';
  openModal(`
    <form id="rf" class="form">
      <h2>${reject ? 'ปฏิเสธการสมัคร' : 'ระงับบัญชี'}: ${esc(u.username)}</h2>
      <label>เหตุผล (ผู้ใช้จะเห็นข้อความนี้)<textarea name="reason" rows="3" maxlength="300" required></textarea></label>
      <p class="form-msg" id="rfMsg" role="alert"></p>
      <div class="row-end"><button type="button" class="btn ghost" data-close>ยกเลิก</button>
        <button class="btn danger" type="submit">${reject ? 'ปฏิเสธ' : 'ระงับบัญชี'}</button></div>
    </form>`, (d) => {
    $('#rf', d).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const reason = new FormData(ev.target).get('reason').trim();
      withBusy(ev.submitter, async () => {
        if (!reason) throw new Error('กรุณาระบุเหตุผล');
        await q(sb.rpc('gm_review_user', { p_user: u.id, p_action: action, p_reason: reason }));
        toast(reject ? 'ปฏิเสธการสมัครแล้ว' : 'ระงับบัญชีแล้ว');
        closeModal(); renderGM('users');
      }, $('#rfMsg', d));
    });
  });
}

async function gameModal(g) {
  let src = null; let ovr = [];
  const cats = await q(sb.from('categories').select('id,name_th').order('sort_order'));
  if (g) {
    [src, ovr] = await Promise.all([
      q(sb.from('game_sources').select('play_url').eq('game_id', g.id).maybeSingle()),
      q(sb.from('game_tier_overrides').select('*').eq('game_id', g.id)),
    ]);
  }
  const ov = Object.fromEntries((ovr || []).map((o) => [o.tier_code, o.allowed ? 'allow' : 'deny']));
  openModal(`
    <form id="gf" class="form" novalidate>
      <h2>${g ? 'แก้ไขเกม' : 'เพิ่มเกมใหม่'}</h2>
      <div class="cols">
        <label>ชื่อเกม *<input name="title" required maxlength="80" value="${esc(g?.title)}"></label>
        <label>Slug (a-z, 0-9, -) *<input name="slug" required maxlength="60" value="${esc(g?.slug)}" autocapitalize="none"></label>
        <label>หมวดหมู่<select name="category_id"><option value="">— ไม่มี —</option>
          ${cats.map((c) => `<option value="${c.id}" ${g?.category_id === c.id ? 'selected' : ''}>${esc(c.name_th)}</option>`).join('')}</select></label>
        <label>ระดับขั้นต่ำ *<select name="min_tier">${tierOptions(g?.min_tier || 'normal')}</select></label>
      </div>
      <label>ลิงก์เล่นเกม (HTTPS) *<input name="play_url" type="url" required value="${esc(src?.play_url)}" placeholder="https://your-game-host.example/game/index.html"></label>
      <label>ลิงก์ภาพปก (HTTPS)<input name="thumbnail_url" type="url" value="${esc(g?.thumbnail_url)}"></label>
      <label>คำอธิบายสั้น<input name="short_description" maxlength="160" value="${esc(g?.short_description)}"></label>
      <label>รายละเอียด<textarea name="description" rows="4" maxlength="4000">${esc(g?.description)}</textarea></label>
      <label>ภาพหน้าจอ (ลิงก์ HTTPS บรรทัดละ 1 รูป)<textarea name="screenshots" rows="3">${esc((g?.screenshots || []).join('\n'))}</textarea></label>
      <fieldset class="ovr"><legend>ข้อยกเว้นรายระดับ (VIP เล่นได้ทุกเกมที่เผยแพร่เสมอ)</legend>
        ${['normal', 'plus', 'pro'].map((t) => `<label>${TIER_LABEL[t]}<select name="ovr_${t}">
          <option value="inherit">ตามค่าเริ่มต้น</option>
          <option value="allow" ${ov[t] === 'allow' ? 'selected' : ''}>อนุญาตเสมอ</option>
          <option value="deny" ${ov[t] === 'deny' ? 'selected' : ''}>ไม่อนุญาต</option></select></label>`).join('')}
      </fieldset>
      <fieldset class="ovr"><legend>โหมดเกม</legend>
        ${MODES.map((m) => `<label class="check"><input type="checkbox" name="modes" value="${m.key}" ${(g?.modes || []).includes(m.key) ? 'checked' : ''}> ${m.label}</label>`).join('')}
      </fieldset>
      <div class="checks">
        <label class="check"><input type="checkbox" name="is_published" ${g?.is_published ? 'checked' : ''}> เผยแพร่</label>
        <label class="check"><input type="checkbox" name="is_featured" ${g?.is_featured ? 'checked' : ''}> เกมแนะนำ</label>
      </div>
      <p class="form-msg" id="gfMsg" role="alert"></p>
      <div class="row-end"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" type="submit">บันทึกเกม</button></div>
    </form>`, (d) => {
    $('#gf', d).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      withBusy(ev.submitter, async () => {
        const https = (u) => /^https:\/\/\S+$/.test(u);
        const slug = f.slug.trim().toLowerCase();
        const shots = f.screenshots.split('\n').map((s) => s.trim()).filter(Boolean);
        if (!f.title.trim()) throw new Error('กรุณากรอกชื่อเกม');
        if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new Error('Slug ใช้ได้เฉพาะ a-z, 0-9 และ - (2–60 ตัว)');
        if (!https(f.play_url.trim())) throw new Error('ลิงก์เล่นเกมต้องขึ้นต้นด้วย https://');
        if (f.thumbnail_url.trim() && !https(f.thumbnail_url.trim())) throw new Error('ลิงก์ภาพปกต้องขึ้นต้นด้วย https://');
        if (shots.some((u) => !https(u))) throw new Error('ลิงก์ภาพหน้าจอทุกรายการต้องขึ้นต้นด้วย https://');

        const payload = {
          title: f.title.trim(), slug, category_id: f.category_id || null, min_tier: f.min_tier,
          thumbnail_url: f.thumbnail_url.trim() || null, short_description: f.short_description.trim(),
          description: f.description.trim(), screenshots: shots,
          is_published: !!f.is_published, is_featured: !!f.is_featured,
          modes: $$('input[name="modes"]:checked', ev.target).map((x) => x.value),
        };
        let id = g?.id;
        if (id) await q(sb.from('games').update(payload).eq('id', id));
        else id = (await q(sb.from('games').insert(payload).select('id').single())).id;
        await q(sb.from('game_sources').upsert({ game_id: id, play_url: f.play_url.trim() }));
        for (const t of ['normal', 'plus', 'pro']) {
          const v = f[`ovr_${t}`];
          if (v === 'inherit') await q(sb.from('game_tier_overrides').delete().eq('game_id', id).eq('tier_code', t));
          else await q(sb.from('game_tier_overrides').upsert({ game_id: id, tier_code: t, allowed: v === 'allow' }));
        }
        closeModal(); toast('บันทึกเกมเรียบร้อย'); rerenderGM('games');
      }, $('#gfMsg', d));
    });
  });
}

function categoryModal(c) {
  const iconKeys = ['cards', 'dice', 'action', 'puzzle', 'adventure', 'sports', 'coin', 'star', 'heart', 'bomb', 'other'];
  openModal(`
    <form id="cf" class="form" novalidate>
      <h2>${c ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}</h2>
      <div class="cols">
        <label>ชื่อหมวดหมู่ *<input name="name_th" required maxlength="40" value="${esc(c?.name_th)}"></label>
        <label>Slug *<input name="slug" required maxlength="40" value="${esc(c?.slug)}" autocapitalize="none"></label>
        <label>ไอคอน<select name="icon">${iconKeys.map((k) => `<option value="${k}" ${c?.icon === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>ลำดับการแสดง<input name="sort_order" type="number" value="${c?.sort_order ?? 100}"></label>
      </div>
      <label class="check"><input type="checkbox" name="is_active" ${c?.is_active !== false ? 'checked' : ''}> แสดงหมวดหมู่นี้</label>
      <p class="form-msg" id="cfMsg" role="alert"></p>
      <div class="row-end"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" type="submit">บันทึก</button></div>
    </form>`, (d) => {
    $('#cf', d).addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      withBusy(ev.submitter, async () => {
        const slug = f.slug.trim().toLowerCase();
        if (!f.name_th.trim()) throw new Error('กรุณากรอกชื่อหมวดหมู่');
        if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new Error('Slug ใช้ได้เฉพาะ a-z, 0-9 และ -');
        const payload = { name_th: f.name_th.trim(), slug, icon: f.icon, sort_order: Number(f.sort_order) || 100, is_active: !!f.is_active };
        if (c) await q(sb.from('categories').update(payload).eq('id', c.id));
        else await q(sb.from('categories').insert(payload));
        closeModal(); toast('บันทึกหมวดหมู่แล้ว'); rerenderGM('categories');
      }, $('#cfMsg', d));
    });
  });
}

// ---------------------------------------------------------------- ambient energy particles
function startParticles() {
  const c = $('#energy'); if (!c?.getContext) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = c.getContext('2d');
  const colors = ['168,85,247', '59,130,246', '236,72,153', '34,211,238'];
  let w = 0, h = 0, dpr = 1, ps = [], raf = 0;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    c.style.width = `${innerWidth}px`; c.style.height = `${innerHeight}px`;
    const n = Math.round(Math.min(60, innerWidth / 24));
    ps = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.8 + 0.4) * dpr,
      vx: (Math.random() - 0.5) * 0.25 * dpr, vy: (-Math.random() * 0.4 - 0.08) * dpr,
      c: colors[(Math.random() * colors.length) | 0], a: Math.random() * 0.55 + 0.2,
    }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.shadowBlur = 10 * dpr; ctx.shadowColor = `rgba(${p.c},.9)`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
  };
  resize();
  addEventListener('resize', () => { resize(); if (reduce) draw(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) { cancelAnimationFrame(raf); draw(); } });
  draw();
}

boot();
