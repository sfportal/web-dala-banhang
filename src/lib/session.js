// Phiên đăng nhập dùng chung: quản trị, cộng tác viên (cũ), khách hàng
import { first, run } from './db.js';
import { randomToken, getCookie } from './util.js';

const SESSION_DAYS = { admin: 7, aff: 30, cust: 60 };
const COOKIE = { admin: 'dala_admin', aff: 'dala_aff', cust: 'dala_cust' };

// Tạo phiên và trả token (Zalo Mini App gửi lại bằng header Authorization vì không dùng được cookie khác tên miền)
export async function createSessionToken(env, kind, userId) {
  const token = randomToken(24);
  await run(env, "INSERT INTO sessions (token, kind, user_id, expires_at) VALUES (?,?,?, datetime('now', ?))", token, kind, userId, `+${SESSION_DAYS[kind]} days`);
  return token;
}
function bearer(request) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+([A-Za-z0-9_-]{16,})$/);
  return m ? m[1] : null;
}
export async function createSession(env, kind, userId, request) {
  const token = await createSessionToken(env, kind, userId);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE[kind]}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS[kind] * 86400}${secure}`;
}
export async function getSession(env, request, kind) {
  const token = getCookie(request, COOKIE[kind]) || bearer(request);
  if (!token) return null;
  return first(env, "SELECT * FROM sessions WHERE token=? AND kind=? AND expires_at > datetime('now')", token, kind);
}
export async function endSession(env, request, kind) {
  const token = getCookie(request, COOKIE[kind]) || bearer(request);
  if (token) await run(env, 'DELETE FROM sessions WHERE token=?', token);
  return `${COOKIE[kind]}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
