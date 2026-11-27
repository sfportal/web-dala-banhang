// /api/zalo/*: đăng nhập bằng số điện thoại Zalo và lấy vị trí cho Zalo Mini App.
// Mini app chỉ nhận được "token" từ Zalo; máy chủ đổi token ra số điện thoại / toạ độ qua Graph API bằng khoá bí mật của Zalo App
// (Admin → Cài đặt → Zalo Mini App, hoặc biến môi trường ZALO_APP_SECRET). Mã định danh Zalo không được lưu.
import { first, run, getSecret } from '../lib/db.js';
import { HttpError, json, readBody, normPhone, validPhone, hashPassword, randomToken } from '../lib/util.js';
import { createSessionToken } from '../lib/session.js';

const GRAPH = 'https://graph.zalo.me/v2.0/me';
export const TEST_PHONE = '0999999999';

async function graphDecode(env, accessToken, code) {
  const secret = await getSecret(env, 'zalo_app_secret', 'ZALO_APP_SECRET');
  if (!secret) throw new HttpError(503, 'Cửa hàng chưa cấu hình khoá Zalo App, vui lòng nhập thông tin thủ công');
  if (!accessToken || !code) throw new HttpError(400, 'Thiếu thông tin xác thực Zalo');
  const r = await fetch(GRAPH + '/info', { headers: { access_token: String(accessToken), code: String(code), secret_key: secret } });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.error) throw new HttpError(400, 'Zalo chưa xác nhận được thông tin, vui lòng thử lại');
  return d.data || {};
}

async function zaloName(accessToken) {
  try {
    const r = await fetch(GRAPH + '?fields=name', { headers: { access_token: String(accessToken) } });
    const d = await r.json();
    return d && !d.error ? String(d.name || '').slice(0, 80) : '';
  } catch { return ''; }
}

// Đổi toạ độ ra tỉnh, quận, phường (OpenStreetMap). Trả về các tên để mini app tự khớp với danh sách địa chỉ giao hàng.
export async function reverseGeocode(lat, lng) {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&accept-language=vi&lat=${lat}&lon=${lng}`;
    const r = await fetch(u, { headers: { 'user-agent': 'DaLa-shop/1.0 (+https://dala-shop.sfportal.workers.dev)' } });
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    return {
      province: a.state || a.city || a.province || null,
      district: a.city_district || a.county || a.district || (a.state ? a.city : null) || a.town || null,
      ward: a.quarter || a.suburb || a.village || a.hamlet || a.neighbourhood || null,
      road: [a.house_number, a.road].filter(Boolean).join(' ') || null,
      names: [...new Set(Object.values(a).filter((v) => typeof v === 'string'))],
      display: d.display_name || null,
    };
  } catch { return null; }
}

export async function zaloApi(request, env, p, m) {
  if (p === '/api/zalo/login' && m === 'POST') {
    const b = await readBody(request);
    // Bản test của mini app: đăng nhập bằng số điện thoại mẫu, không gọi Zalo. Chỉ vào được đúng tài khoản mẫu này.
    const test = b.test === true;
    const info = test ? { number: TEST_PHONE } : await graphDecode(env, b.access_token, b.phone_token);
    const phone = normPhone(info.number);
    if (!validPhone(phone)) throw new HttpError(400, 'Không lấy được số điện thoại Zalo');
    const name = test ? 'Khách thử Zalo' : (await zaloName(b.access_token)) || String(b.name || '').trim().slice(0, 80) || null;
    let c = await first(env, 'SELECT * FROM customers WHERE phone=?', phone);
    if (!c) {
      // Mật khẩu ngẫu nhiên: khách đăng nhập website bằng "Quên mật khẩu" (OTP) nếu cần
      const r = await run(env, "INSERT INTO customers (phone, name, source, pass_hash, phone_verified, registered_at, last_login) VALUES (?,?,?,?,1, datetime('now'), datetime('now'))",
        phone, name, 'zalo', await hashPassword(randomToken(18)));
      c = await first(env, 'SELECT * FROM customers WHERE id=?', r.meta.last_row_id);
    } else {
      await run(env, "UPDATE customers SET name=COALESCE(name, ?), phone_verified=1, pass_hash=COALESCE(pass_hash, ?), registered_at=COALESCE(registered_at, datetime('now')), last_login=datetime('now') WHERE id=?",
        name, c.pass_hash ? null : await hashPassword(randomToken(18)), c.id);
      await run(env, 'UPDATE affiliates SET phone_verified=1 WHERE customer_id=?', c.id);
    }
    const token = await createSessionToken(env, 'cust', c.id);
    return json({ token, customer: { name: c.name || name, phone } });
  }

  if (p === '/api/zalo/location' && m === 'POST') {
    const b = await readBody(request);
    const info = await graphDecode(env, b.access_token, b.location_token);
    const lat = Number(info.latitude), lng = Number(info.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'Không lấy được vị trí');
    return json({ lat, lng, address: await reverseGeocode(lat, lng) });
  }
  throw new HttpError(404, 'Không tìm thấy');
}
