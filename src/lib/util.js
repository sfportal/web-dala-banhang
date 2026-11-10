// Tiện ích dùng chung (chạy được cả trên Workers lẫn Node để kiểm thử)

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const nowSql = (d = new Date()) => d.toISOString().replace('T', ' ').slice(0, 19);
export const addDays = (d, n) => new Date(d.getTime() + n * 86400e3);
export const parseSql = (s) => (s ? new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z')) : null);

export const vnd = (n) => (Math.round(Number(n) || 0)).toLocaleString('vi-VN') + 'đ';

export function normPhone(p) {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  if (s.startsWith('84') && s.length === 11) s = '0' + s.slice(2);
  return s;
}
export const validPhone = (p) => /^0\d{9}$/.test(normPhone(p));

export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function randomCode(len = 6, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  const b = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join('');
}
export function randomToken(bytes = 24) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function parseJson(s, fallback) {
  if (s == null || s === '') return fallback;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

// ---- mật khẩu: PBKDF2-SHA256, 100k vòng
const enc = new TextEncoder();
const toHex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
async function pbkdf2(password, salt, iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$100000$${toHex(salt)}$${toHex(await pbkdf2(password, salt))}`;
}
export async function verifyPassword(password, stored) {
  const [alg, it, salt, hash] = String(stored || '').split('$');
  if (alg !== 'pbkdf2' || !hash) return false;
  const h = toHex(await pbkdf2(password, fromHex(salt), Number(it)));
  if (h.length !== hash.length) return false;
  let d = 0;
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ hash.charCodeAt(i);
  return d === 0;
}

export async function hmacSha256(secret, data, encoding = 'hex') {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  if (encoding === 'base64') return btoa(String.fromCharCode(...new Uint8Array(sig)));
  return toHex(sig);
}

export function getCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { return await request.json(); } catch { throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ'); }
  }
  if (ct.includes('form')) return Object.fromEntries(await request.formData());
  const t = await request.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ'); }
}

export function toCsv(rows, cols) {
  const escCell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\ufeff' + [cols.map((c) => c.label).join(','), ...rows.map((r) => cols.map((c) => escCell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','))].join('\n');
}

// CSV đơn giản (có ngoặc kép), dùng để nhập đơn TikTok Shop / Shopee
export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const s = String(text || '').replace(/^\ufeff/, '');
  const head = s.split(/\r?\n/, 1)[0];
  const delim = [',', '\t', ';'].sort((a, b) => head.split(b).length - head.split(a).length)[0];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}
