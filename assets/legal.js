// แก้อีเมลติดต่อที่บรรทัดนี้บรรทัดเดียว แล้วทุกหน้ากฎหมายจะเปลี่ยนตาม
const CONTACT_EMAIL = 'aorta_aortic@hotmail.com';

document.querySelectorAll('[data-email]').forEach((el) => {
  el.textContent = CONTACT_EMAIL;
  if (el.tagName === 'A' && CONTACT_EMAIL.includes('@')) {
    const sub = el.dataset.subject ? `?subject=${encodeURIComponent(el.dataset.subject)}` : '';
    el.href = `mailto:${CONTACT_EMAIL}${sub}`;
  }
});
