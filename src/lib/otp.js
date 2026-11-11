// Xác thực số điện thoại bằng OTP qua Zalo (ZNS) và SMS.
// Gửi và kiểm tra mã chỉ qua API web Thu-Chi (/api/v1/otp); website không giữ khoá eSMS.
// provider 'test' chỉ dùng trên máy phát triển (localhost).
// - Kênh "zalo_sms": gửi ZNS trước, nếu eSMS từ chối thì gửi SMS brandname cùng mã
// - Mã 6 số, lưu dạng băm, hết hạn sau ttl_minutes, tối đa 5 lần nhập sai
// - Giới hạn: 60 giây giữa hai lần gửi, 5 lần/giờ mỗi số, 15 lần/giờ mỗi IP
import { first, run, getSetting } from './db.js';
import { HttpError, normPhone, validPhone } from './util.js';
import { thuchiConfig, thuchiCall } from './payment.js';

const MAX_ATTEMPTS = 5;
export const OTP_PURPOSES = ['signup', 'affiliate', 'reset', 'test'];

export const DEFAULT_AUTH = {
  otp_signup: false, otp_affiliate: false, channel: 'zalo_sms', provider: 'thuchi', thuchi_account_id: null, ttl_minutes: 5, policy_version: '2026-11',
};

export async function otpConfig(env) {
  const s = (await getSetting(env, 'auth', {})) || {};
  const auth = { ...DEFAULT_AUTH, ...s };
  if (auth.provider !== 'test') auth.provider = 'thuchi';
  const ready = auth.provider === 'test' || (await thuchiConfig(env)).enabled;
  return { auth, ready };
}

// Có bắt buộc OTP cho mục đích này không (chỉ khi admin bật)
export async function otpRequired(env, purpose) {
  const { auth } = await otpConfig(env);
  return purpose === 'affiliate' ? !!auth.otp_affiliate : purpose === 'signup' ? !!auth.otp_signup : purpose === 'reset';
}

function genCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashCode(phone, purpose, code, salt) {
  return salt + '$' + (await sha(`${salt}:${phone}:${purpose}:${code}`));
}
function salt() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const isLocal = (host) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host || '');

export async function sendOtp(env, { phone, purpose, ip, host, skipLimits = false }) {
  const p = normPhone(phone);
  if (!validPhone(p)) throw new HttpError(400, 'Số điện thoại chưa đúng');
  if (!OTP_PURPOSES.includes(purpose)) throw new HttpError(400, 'Mục đích xác thực không hợp lệ');
  const cfg = await otpConfig(env);
  if (!cfg.ready) throw new HttpError(503, 'Chưa cấu hình gửi mã xác thực, vui lòng liên hệ DaLa');
  if (cfg.auth.provider === 'test' && !isLocal(host)) throw new HttpError(503, 'Chế độ thử OTP chỉ dùng trên máy phát triển');

  if (!skipLimits) {
    const last = await first(env, "SELECT created_at FROM otp_codes WHERE phone=? AND created_at > datetime('now','-60 seconds') ORDER BY id DESC LIMIT 1", p);
    if (last) throw new HttpError(429, 'Vui lòng đợi 60 giây trước khi gửi lại mã');
    const hour = await first(env, "SELECT COUNT(*) n FROM otp_codes WHERE phone=? AND created_at > datetime('now','-1 hour')", p);
    if (hour.n >= 5) throw new HttpError(429, 'Số này đã nhận quá nhiều mã, vui lòng thử lại sau 1 giờ');
    if (ip) {
      const byIp = await first(env, "SELECT COUNT(*) n FROM otp_codes WHERE ip=? AND created_at > datetime('now','-1 hour')", ip);
      if (byIp.n >= 15) throw new HttpError(429, 'Bạn đã yêu cầu quá nhiều mã, vui lòng thử lại sau');
    }
  }

  const code = genCode();
  const ttl = Math.min(15, Math.max(2, Number(cfg.auth.ttl_minutes) || 5));
  const r = await run(env, "INSERT INTO otp_codes (phone, purpose, code_hash, provider, status, ip, expires_at) VALUES (?,?,?,?, 'sending', ?, datetime('now', ?))",
    p, purpose, await hashCode(p, purpose, code, salt()), cfg.auth.provider, ip || null, `+${ttl} minutes`);
  const id = r.meta.last_row_id;

  if (cfg.auth.provider === 'thuchi') {
    try {
      const d = await thuchiCall(env, '/otp/send', { method: 'POST', body: { phone: p, channel: cfg.auth.channel || undefined, purpose, account_id: Number(cfg.auth.thuchi_account_id) || undefined } });
      if (d.status === 'failed') throw new HttpError(502, d.send_error || 'eSMS không nhận yêu cầu gửi');
      await run(env, "UPDATE otp_codes SET status='sent', channel=?, ext_ref=? WHERE id=?", d.channel || cfg.auth.channel, d.request_id, id);
      return { ok: true, channel: d.channel || cfg.auth.channel, ttl };
    } catch (e) {
      await run(env, "UPDATE otp_codes SET status='failed', error=? WHERE id=?", String(e.message).slice(0, 300), id);
      if (e.status === 429) throw new HttpError(429, e.message);
      throw new HttpError(502, purpose === 'test' ? `Gửi thất bại: ${e.message}` : 'Chưa gửi được mã xác thực, vui lòng thử lại sau ít phút');
    }
  }
  if (cfg.auth.provider === 'test') {
    await run(env, "UPDATE otp_codes SET status='sent', channel='test' WHERE id=?", id);
    return { ok: true, channel: 'test', ttl, dev_code: code };
  }
  throw new HttpError(503, 'Chưa cấu hình gửi mã xác thực');
}

// Kiểm tra mã; đúng thì đánh dấu đã dùng (mỗi mã dùng một lần)
export async function verifyOtp(env, { phone, purpose, code }) {
  const p = normPhone(phone);
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) throw new HttpError(400, 'Vui lòng nhập mã xác thực 6 số');
  const row = await first(env, "SELECT * FROM otp_codes WHERE phone=? AND purpose=? AND status='sent' ORDER BY id DESC LIMIT 1", p, purpose);
  if (!row) throw new HttpError(400, 'Mã xác thực không đúng hoặc đã hết hạn, vui lòng gửi lại mã');
  const expired = await first(env, "SELECT 1 x WHERE ? < datetime('now')", row.expires_at);
  if (expired) { await run(env, "UPDATE otp_codes SET status='expired' WHERE id=?", row.id); throw new HttpError(400, 'Mã xác thực đã hết hạn, vui lòng gửi lại mã'); }
  if (row.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Nhập sai quá nhiều lần, vui lòng gửi lại mã');
  if (row.provider === 'thuchi') {
    const d = await thuchiCall(env, '/otp/verify', { method: 'POST', body: { request_id: row.ext_ref, code: c } });
    if (d.verified) { await run(env, "UPDATE otp_codes SET status='verified', verified_at=datetime('now') WHERE id=?", row.id); return true; }
    await run(env, 'UPDATE otp_codes SET attempts=attempts+1, status=? WHERE id=?', ['expired', 'locked'].includes(d.status) ? 'expired' : 'sent', row.id);
    throw new HttpError(400, d.status === 'expired' ? 'Mã xác thực đã hết hạn, vui lòng gửi lại mã' : d.status === 'locked' ? 'Nhập sai quá nhiều lần, vui lòng gửi lại mã' : d.message || 'Mã xác thực chưa đúng');
  }
  const [s] = row.code_hash.split('$');
  if ((await hashCode(p, purpose, c, s)) !== row.code_hash) {
    await run(env, 'UPDATE otp_codes SET attempts=attempts+1 WHERE id=?', row.id);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new HttpError(400, left > 0 ? `Mã xác thực chưa đúng, còn ${left} lần thử` : 'Nhập sai quá nhiều lần, vui lòng gửi lại mã');
  }
  await run(env, "UPDATE otp_codes SET status='verified', verified_at=datetime('now') WHERE id=?", row.id);
  return true;
}

export async function listOtpAccounts(env) {
  return thuchiCall(env, '/otp/accounts');
}

export const _test = { genCode, hashCode };
