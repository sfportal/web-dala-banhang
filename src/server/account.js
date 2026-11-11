// /api/account/*: tài khoản khách hàng bằng số điện thoại, xem đơn đã mua, đăng ký cộng tác viên
// - Đặt hàng không cần đăng nhập. Tạo tài khoản bằng SĐT đã từng mua thì thấy luôn các đơn cũ cùng SĐT.
// - Khi admin bật OTP, đăng ký tài khoản / đăng ký CTV phải nhập mã gửi qua Zalo hoặc SMS.
// - Chưa xác thực SĐT thì chỉ xem tóm tắt đơn (ẩn địa chỉ, không mở trang chi tiết) để tránh lộ thông tin.
import { all, first, run, getSettings } from '../lib/db.js';
import { HttpError, json, readBody, normPhone, validPhone, hashPassword, verifyPassword, randomCode, slugify } from '../lib/util.js';
import { createSession, getSession, endSession } from '../lib/session.js';
import { sendOtp, verifyOtp, otpConfig } from '../lib/otp.js';
import { STATUS_LABEL, PAY_LABEL } from '../lib/orders.js';
import { loyaltyConfig } from '../lib/loyalty.js';
import { activeFlash } from '../lib/catalog.js';
import { orderToken, publicTracking, orderEta } from './api.js';

const BANK_RE = /^\d{6,20}$/;
const TAX_RE = /^\d{10}(\d{2})?$|^\d{10}-\d{3}$/;
const ID_RE = /^\d{12}$/;

export async function newAffiliateCode(env, name) {
  let code = slugify(name).replace(/-/g, '').toUpperCase().slice(0, 6) || 'DALA';
  for (let i = 0; i < 8; i++) {
    const c = code + randomCode(3, '23456789');
    if (!(await first(env, 'SELECT 1 FROM affiliates WHERE code=?', c))) return c;
  }
  return 'DALA' + randomCode(6, '23456789');
}

// CTV gắn với tài khoản khách đang đăng nhập (dùng cho cổng /ctv)
export async function linkedAffiliate(env, request) {
  const s = await getSession(env, request, 'cust');
  if (!s) return null;
  return first(env, 'SELECT * FROM affiliates WHERE customer_id=?', s.user_id);
}

function publicCustomer(c) {
  return { id: c.id, phone: c.phone, name: c.name, email: c.email, address: c.address, province: c.province, phone_verified: !!c.phone_verified, registered_at: c.registered_at };
}
const maskAddr = (s) => (s ? String(s).replace(/^(.{0,6}).*$/, '$1') + '…' : '');

function clientIp(request) { return request.headers.get('cf-connecting-ip') || null; }

export async function accountApi(request, env, url, p, m) {
  const settings = await getSettings(env);
  const { auth, ready: otpReady } = await otpConfig(env);
  const flags = { otp_signup: !!auth.otp_signup && otpReady, otp_affiliate: !!auth.otp_affiliate && otpReady, otp_available: otpReady, policy_version: auth.policy_version };

  if (p === '/otp' && m === 'POST') {
    const b = await readBody(request);
    const phone = normPhone(b.phone);
    const purpose = String(b.purpose || '');
    if (!['signup', 'affiliate', 'reset'].includes(purpose)) throw new HttpError(400, 'Mục đích xác thực không hợp lệ');
    const c = await first(env, 'SELECT id, pass_hash FROM customers WHERE phone=?', phone);
    if (purpose === 'signup' && c?.pass_hash) throw new HttpError(409, 'Số điện thoại đã có tài khoản, vui lòng đăng nhập');
    if (purpose === 'reset' && !c?.pass_hash) throw new HttpError(404, 'Số điện thoại chưa có tài khoản');
    if (purpose === 'affiliate') {
      const s = await getSession(env, request, 'cust');
      const me = s && await first(env, 'SELECT phone FROM customers WHERE id=?', s.user_id);
      if (!me || me.phone !== phone) throw new HttpError(401, 'Vui lòng đăng nhập');
    }
    return json(await sendOtp(env, { phone, purpose, ip: clientIp(request), host: url.hostname }));
  }

  if (p === '/register' && m === 'POST') {
    const b = await readBody(request);
    const phone = normPhone(b.phone);
    const name = String(b.name || '').trim().slice(0, 80);
    if (name.length < 2) throw new HttpError(400, 'Vui lòng nhập họ tên');
    if (!validPhone(phone)) throw new HttpError(400, 'Số điện thoại chưa đúng');
    if (String(b.password || '').length < 6) throw new HttpError(400, 'Mật khẩu tối thiểu 6 ký tự');
    const existing = await first(env, 'SELECT * FROM customers WHERE phone=?', phone);
    if (existing?.pass_hash) throw new HttpError(409, 'Số điện thoại đã có tài khoản, vui lòng đăng nhập');
    let verified = 0;
    if (flags.otp_signup) { await verifyOtp(env, { phone, purpose: 'signup', code: b.otp }); verified = 1; }
    const hash = await hashPassword(String(b.password));
    let id;
    if (existing) {
      // SĐT đã từng đặt hàng: nhận lại hồ sơ, các đơn cũ hiện ngay trong tài khoản
      await run(env, "UPDATE customers SET pass_hash=?, name=COALESCE(name, ?), email=COALESCE(email, ?), phone_verified=MAX(phone_verified, ?), registered_at=datetime('now'), last_login=datetime('now') WHERE id=?",
        hash, name, b.email || null, verified, existing.id);
      id = existing.id;
    } else {
      const r = await run(env, "INSERT INTO customers (phone, name, email, source, pass_hash, phone_verified, registered_at, last_login) VALUES (?,?,?,?,?,?, datetime('now'), datetime('now'))",
        phone, name, b.email || null, 'account', hash, verified);
      id = r.meta.last_row_id;
    }
    const past = await first(env, 'SELECT COUNT(*) n FROM orders WHERE phone=? OR customer_id=?', phone, id);
    return json({ ok: true, past_orders: past.n }, 200, { 'set-cookie': await createSession(env, 'cust', id, request) });
  }

  if (p === '/login' && m === 'POST') {
    const b = await readBody(request);
    const phone = normPhone(b.phone);
    const pw = String(b.password || '');
    let c = await first(env, 'SELECT * FROM customers WHERE phone=?', phone);
    if (!c?.pass_hash) {
      // CTV đăng ký từ bản cũ: đăng nhập bằng mật khẩu CTV rồi chuyển sang tài khoản khách
      const a = await first(env, 'SELECT * FROM affiliates WHERE phone=?', phone);
      if (!a || !(await verifyPassword(pw, a.pass_hash))) throw new HttpError(401, 'Sai số điện thoại hoặc mật khẩu');
      if (!c) {
        const r = await run(env, "INSERT INTO customers (phone, name, email, province, source) VALUES (?,?,?,?, 'ctv')", phone, a.name, a.email, a.province);
        c = { id: r.meta.last_row_id };
      }
      await run(env, "UPDATE customers SET pass_hash=?, registered_at=COALESCE(registered_at, datetime('now')) WHERE id=?", a.pass_hash, c.id);
      await run(env, 'UPDATE affiliates SET customer_id=? WHERE id=?', c.id, a.id);
      c = await first(env, 'SELECT * FROM customers WHERE id=?', c.id);
    } else if (!(await verifyPassword(pw, c.pass_hash))) throw new HttpError(401, 'Sai số điện thoại hoặc mật khẩu');
    await run(env, "UPDATE customers SET last_login=datetime('now') WHERE id=?", c.id);
    return json({ ok: true }, 200, { 'set-cookie': await createSession(env, 'cust', c.id, request) });
  }

  if (p === '/reset' && m === 'POST') {
    const b = await readBody(request);
    const phone = normPhone(b.phone);
    const c = await first(env, 'SELECT * FROM customers WHERE phone=? AND pass_hash IS NOT NULL', phone);
    if (!c) throw new HttpError(404, 'Số điện thoại chưa có tài khoản');
    if (String(b.password || '').length < 6) throw new HttpError(400, 'Mật khẩu mới tối thiểu 6 ký tự');
    await verifyOtp(env, { phone, purpose: 'reset', code: b.otp });
    const hash = await hashPassword(String(b.password));
    await run(env, 'UPDATE customers SET pass_hash=?, phone_verified=1 WHERE id=?', hash, c.id);
    await run(env, 'UPDATE affiliates SET pass_hash=?, phone_verified=1 WHERE customer_id=?', hash, c.id);
    await run(env, "DELETE FROM sessions WHERE kind='cust' AND user_id=?", c.id);
    return json({ ok: true }, 200, { 'set-cookie': await createSession(env, 'cust', c.id, request) });
  }

  if (p === '/logout' && m === 'POST') {
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    headers.append('set-cookie', await endSession(env, request, 'cust'));
    headers.append('set-cookie', await endSession(env, request, 'aff'));
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  const sess = await getSession(env, request, 'cust');
  const me = sess && await first(env, 'SELECT * FROM customers WHERE id=? AND pass_hash IS NOT NULL', sess.user_id);
  if (!me && p === '/me') return json({ guest: true, flags });
  if (!me) throw new HttpError(401, 'Vui lòng đăng nhập');
  const aff = await first(env, 'SELECT id, code, status, name, created_at FROM affiliates WHERE customer_id=?', me.id);

  if (p === '/me' && m === 'GET') {
    const lc = await loyaltyConfig(env);
    const loyalty = { enabled: lc.enabled, points: me.points || 0, value: (me.points || 0) * lc.point_value, earn_per: lc.earn_per, point_value: lc.point_value, max_redeem_pct: lc.max_redeem_pct, min_redeem: lc.min_redeem };
    const stats = await first(env, "SELECT COUNT(*) n, IFNULL(SUM(CASE WHEN status NOT IN ('cancelled','returned') THEN total END),0) spent FROM orders WHERE phone=? OR customer_id=?", me.phone, me.id);
    return json({ customer: publicCustomer(me), affiliate: aff || null, stats, flags, loyalty });
  }

  if (p === '/orders' && m === 'GET') {
    const rows = await all(env, `SELECT id, code, created_at, status, payment_status, payment_method, total, shipping_fee, discount, address, province, tracking_code, tracking_url, ship_status_text, shipping_expected, eta_from, eta_to
      FROM orders WHERE phone=? OR customer_id=? ORDER BY id DESC LIMIT 100`, me.phone, me.id);
    const items = rows.length ? await all(env, `SELECT order_id, name, qty, price FROM order_items WHERE order_id IN (${rows.map(() => '?').join(',')})`, ...rows.map((r) => r.id)) : [];
    const verified = !!me.phone_verified;
    const out = [];
    const settings = await getSettings(env);
    for (const [n, r] of rows.entries()) {
      // Lịch sử chi tiết chỉ cho tài khoản đã xác thực SĐT, 20 đơn gần nhất
      const tr = verified && n < 20 ? await publicTracking(env, r, settings) : { eta: orderEta(r, settings), timeline: null };
      out.push({
        eta: tr.eta, timeline: tr.timeline,
        code: r.code, created_at: r.created_at, status: r.status, status_label: STATUS_LABEL[r.status], payment_status: r.payment_status, payment_label: PAY_LABEL[r.payment_status],
        payment_method: r.payment_method, total: r.total, shipping_fee: r.shipping_fee, discount: r.discount,
        address: verified ? [r.address, r.province].filter(Boolean).join(', ') : maskAddr(r.address),
        tracking_code: r.tracking_code, tracking_url: r.tracking_url, ship_status_text: r.ship_status_text,
        items: items.filter((i) => i.order_id === r.id).map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
        link: verified ? `/don-hang/${r.code}?t=${await orderToken(env, r.code)}` : null,
      });
    }
    return json({ verified, orders: out });
  }

  if (p === '/points' && m === 'GET') {
    const rows = await all(env, `SELECT l.type, l.points, l.note, l.created_at, o.code FROM points_ledger l LEFT JOIN orders o ON o.id=l.order_id
      WHERE l.customer_id=? ORDER BY l.id DESC LIMIT 100`, me.id);
    return json({ points: me.points || 0, history: rows });
  }

  if (p === '/promos' && m === 'GET') {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const vs = await all(env, `SELECT code, type, value, min_order, max_discount, first_order_only, ends_at, note FROM vouchers
      WHERE active=1 AND public=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?) AND (usage_limit IS NULL OR used<usage_limit)
      ORDER BY created_at DESC LIMIT 30`, now, now);
    const firstDone = await first(env, "SELECT 1 x FROM orders WHERE (phone=? OR customer_id=?) AND status!='cancelled' LIMIT 1", me.phone, me.id);
    const flash = await activeFlash(env);
    return json({
      vouchers: vs.filter((v) => !(v.first_order_only && firstDone)),
      flash: flash.sale ? { name: flash.sale.name, ends_at: flash.sale.ends_at, items: flash.items.size } : null,
      flash_next: !flash.sale && flash.next ? { name: flash.next.name, starts_at: flash.next.starts_at } : null,
    });
  }

  if (p === '/verify-phone' && m === 'POST') {
    // Xác thực SĐT sau khi đã có tài khoản (để xem chi tiết đơn cũ)
    const b = await readBody(request);
    await verifyOtp(env, { phone: me.phone, purpose: 'signup', code: b.otp });
    await run(env, 'UPDATE customers SET phone_verified=1 WHERE id=?', me.id);
    await run(env, 'UPDATE affiliates SET phone_verified=1 WHERE customer_id=?', me.id);
    return json({ ok: true });
  }
  if (p === '/verify-phone/send' && m === 'POST') {
    return json(await sendOtp(env, { phone: me.phone, purpose: 'signup', ip: clientIp(request), host: url.hostname }));
  }

  if (p === '/profile' && m === 'PUT') {
    const b = await readBody(request);
    const name = String(b.name || '').trim().slice(0, 80);
    await run(env, 'UPDATE customers SET name=COALESCE(?, name), email=?, address=?, province=? WHERE id=?',
      name || null, String(b.email || '').trim() || null, String(b.address || '').trim().slice(0, 300) || null, String(b.province || '').trim() || null, me.id);
    if (b.new_password) {
      if (!(await verifyPassword(String(b.password || ''), me.pass_hash))) throw new HttpError(400, 'Mật khẩu hiện tại chưa đúng');
      if (String(b.new_password).length < 6) throw new HttpError(400, 'Mật khẩu mới tối thiểu 6 ký tự');
      const h = await hashPassword(String(b.new_password));
      await run(env, 'UPDATE customers SET pass_hash=? WHERE id=?', h, me.id);
      await run(env, 'UPDATE affiliates SET pass_hash=? WHERE customer_id=?', h, me.id);
    }
    return json({ ok: true });
  }

  // Đăng ký làm cộng tác viên từ tài khoản khách
  if (p === '/affiliate' && m === 'POST') {
    if (aff) throw new HttpError(409, 'Tài khoản đã đăng ký cộng tác viên');
    const old = await first(env, 'SELECT id FROM affiliates WHERE phone=?', me.phone);
    if (old) throw new HttpError(409, 'Số điện thoại đã đăng ký cộng tác viên, vui lòng liên hệ DaLa');
    const b = await readBody(request);
    const f = {
      name: String(b.name || '').trim().slice(0, 80),
      birth_date: String(b.birth_date || '').trim(),
      id_number: String(b.id_number || '').replace(/\s/g, ''),
      address: String(b.address || '').trim().slice(0, 300),
      province: String(b.province || '').trim().slice(0, 60),
      email: String(b.email || '').trim().slice(0, 120) || null,
      channel_note: String(b.channel_note || '').trim().slice(0, 300) || null,
      bank_name: String(b.bank_name || '').trim().slice(0, 60),
      bank_account: String(b.bank_account || '').replace(/[\s.-]/g, ''),
      bank_holder: String(b.bank_holder || '').trim().toUpperCase().slice(0, 80),
      tax_code: String(b.tax_code || '').replace(/\s/g, ''),
    };
    if (f.name.length < 4 || !f.name.includes(' ')) throw new HttpError(400, 'Vui lòng nhập đầy đủ họ và tên như trên CCCD');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.birth_date)) throw new HttpError(400, 'Vui lòng nhập ngày sinh');
    const age = (Date.now() - Date.parse(f.birth_date)) / (365.25 * 864e5);
    if (!(age >= 18 && age < 100)) throw new HttpError(400, 'Cộng tác viên cần đủ 18 tuổi');
    if (!ID_RE.test(f.id_number)) throw new HttpError(400, 'Số CCCD gồm 12 chữ số');
    if (f.address.length < 8 || !f.province) throw new HttpError(400, 'Vui lòng nhập địa chỉ và tỉnh/thành');
    if (!f.bank_name || !BANK_RE.test(f.bank_account) || f.bank_holder.length < 4) throw new HttpError(400, 'Vui lòng nhập đủ ngân hàng, số tài khoản và tên chủ tài khoản');
    if (!TAX_RE.test(f.tax_code)) throw new HttpError(400, 'Mã số thuế cá nhân gồm 10 hoặc 12 chữ số');
    if (b.agree_policy !== true) throw new HttpError(400, 'Vui lòng xác nhận đã đọc và đồng ý chính sách cộng tác viên');
    let verified = me.phone_verified ? 1 : 0;
    if (flags.otp_affiliate && !verified) { await verifyOtp(env, { phone: me.phone, purpose: 'affiliate', code: b.otp }); verified = 1; }

    const affSettings = settings.affiliate || {};
    let parent = null;
    if (b.ref) parent = await first(env, "SELECT id FROM affiliates WHERE code=? AND status='active'", String(b.ref).toUpperCase());
    // Khách đã gắn với một CTV thì CTV đó là người giới thiệu mặc định
    if (!parent && me.affiliate_id) parent = await first(env, "SELECT id FROM affiliates WHERE id=? AND status='active'", me.affiliate_id);
    const code = await newAffiliateCode(env, f.name);
    const status = affSettings.auto_approve === false ? 'pending' : 'active';
    await run(env, `INSERT INTO affiliates (code, name, phone, email, pass_hash, parent_id, status, province, channel_note, bank_name, bank_account, bank_holder,
        customer_id, birth_date, id_number, address, tax_code, policy_version, policy_agreed_at, phone_verified)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'), ?)`,
    code, f.name, me.phone, f.email || me.email, me.pass_hash, parent?.id || null, status, f.province, f.channel_note, f.bank_name, f.bank_account, f.bank_holder,
    me.id, f.birth_date, f.id_number, f.address, f.tax_code, auth.policy_version || null, verified);
    if (verified && !me.phone_verified) await run(env, 'UPDATE customers SET phone_verified=1 WHERE id=?', me.id);
    await run(env, 'UPDATE customers SET name=COALESCE(name, ?), province=COALESCE(province, ?) WHERE id=?', f.name, f.province, me.id);
    return json({ ok: true, code, status });
  }

  throw new HttpError(404, 'Không tìm thấy');
}
