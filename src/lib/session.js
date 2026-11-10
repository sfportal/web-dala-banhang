// Phiên đăng nhập dùng chung: quản trị, cộng tác viên (cũ), khách hàng
import { first, run } from './db.js';
import { randomToken, getCookie } from './util.js';

const SESSION_DAYS = { admin: 7, aff: 30, cust: 60 };
const COOKIE = { admin: 'dala_admin', aff: 'dala_aff', cust: 'dala_cust' };

export async function createSession(env, kind, userId, request) {
  const token = randomToken(24);
  await run(env, "INSERT INTO sessions (token, kind, user_id, expires_at) VALUES (?,?,?, datetime('now', ?))", token, kind, userId, `+${SESSION_DAYS[kind]} days`);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE[kind]}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS[kind] * 86400}${secure}`;
}
export async function getSession(env, request, kind) {
  const token = getCookie(request, COOKIE[kind]);
  if (!token) return null;
  return first(env, "SELECT * FROM sessions WHERE token=? AND kind=? AND expires_at > datetime('now')", token, kind);
}
export async function endSession(env, request, kind) {
  const token = getCookie(request, COOKIE[kind]);
  if (token) await run(env, 'DELETE FROM sessions WHERE token=?', token);
  return `${COOKIE[kind]}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
