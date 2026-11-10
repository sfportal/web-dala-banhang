// Bộ định tuyến /api/* cho website, cổng cộng tác viên và trang quản trị
import { all, first, run, stmt, getSettings, getSetting, setSetting, getSecret, SECRET_KEYS } from '../lib/db.js';
import { HttpError, json, readBody, normPhone, validPhone, hashPassword, verifyPassword, randomToken, randomCode, getCookie, nowSql,
  slugify, toCsv, parseCsv, hmacSha256, parseJson } from '../lib/util.js';
import { loadCatalog, priceCart, loadProducts, decorate, activeFlash, parseProduct } from '../lib/catalog.js';
import { checkout, syncPayment, markPaid, setOrderStatus, ensureCommissions, upsertCustomer, refreshCustomerStats, recomputeTier,
  STATUS_LABEL, PAY_LABEL, CHANNEL_LABEL, cronTick } from '../lib/orders.js';
import { walletSummary, LEVEL_NAMES, tierById } from '../lib/commission.js';
import { listCities, listDistricts, listWards, quoteShipping, createShipment, verifyGoshipWebhook, goshipLogin, goshipConfig, GOSHIP_STATUS, buildParcel } from '../lib/shipping.js';
import { testConnection, thuchiConfig } from '../lib/payment.js';
import { createSession, getSession, endSession } from '../lib/session.js';
import { accountApi, linkedAffiliate } from './account.js';
import { sendOtp, otpConfig } from '../lib/otp.js';


// Khoá ký link đơn hàng: ưu tiên secret APP_SECRET, nếu không có thì tự sinh một lần và lưu trong D1
let appSecretCache = null;
async function appSecret(env) {
  if (env.APP_SECRET) return env.APP_SECRET;
  if (appSecretCache) return appSecretCache;
  let v = await getSetting(env, 'secret:app_secret', null);
  if (!v) {
    await run(env, 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'secret:app_secret', JSON.stringify(randomToken(32)));
    v = await getSetting(env, 'secret:app_secret', null);
  }
  appSecretCache = v;
  return v;
}

export async function orderToken(env, code) {
  return (await hmacSha256(await appSecret(env), 'order:' + code)).slice(0, 20);
}

async function ensureAdmin(env) {
  const n = await first(env, 'SELECT COUNT(*) n FROM admins');
  if (n.n === 0) {
    await run(env, "INSERT INTO admins (username, name, pass_hash, role) VALUES ('admin', 'Quản trị', ?, 'admin')", await hashPassword(env.ADMIN_PASSWORD || 'dala12345'));
  }
}

const ROLE_RANK = { viewer: 1, ops: 2, admin: 3 };

// ---------------------------------------------------------------- entry
export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '');
  const m = request.method;
  try {
    if (p.startsWith('/api/admin')) return await adminApi(request, env, url, p.slice('/api/admin'.length) || '/', m);
    if (p.startsWith('/api/account')) return await accountApi(request, env, url, p.slice('/api/account'.length) || '/', m);
    if (p.startsWith('/api/aff')) return await affApi(request, env, url, p.slice('/api/aff'.length) || '/', m);
    return await publicApi(request, env, url, p, m, ctx);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
    console.error(e);
    return json({ error: 'Lỗi máy chủ, vui lòng thử lại' }, 500);
  }
}

// ---------------------------------------------------------------- công khai
async function publicApi(request, env, url, p, m, ctx) {
  let mm;
  if (p === '/api/catalog' && m === 'GET') return json(await loadCatalog(env), 200, { 'cache-control': 'public, max-age=30' });

  if (p === '/api/cart/quote' && m === 'POST') {
    const b = await readBody(request);
    const q = await priceCart(env, b, { withShipping: !!(b.to && (b.to.province || b.to.city)) });
    return json(q);
  }

  if (p === '/api/checkout' && m === 'POST') {
    const b = await readBody(request);
    if (b.website) throw new HttpError(400, 'Không hợp lệ'); // bẫy bot
    const { order } = await checkout(env, b, { sid: b.sid, utm_source: b.utm?.source, utm_medium: b.utm?.medium, utm_campaign: b.utm?.campaign });
    return json({ code: order.code, token: await orderToken(env, order.code), total: order.total, payment_method: order.payment_method });
  }

  if ((mm = p.match(/^\/api\/orders\/(DL\d{6})$/)) && m === 'GET') {
    const code = mm[1];
    if (url.searchParams.get('t') !== (await orderToken(env, code))) throw new HttpError(403, 'Liên kết đơn hàng không hợp lệ');
    let o = await first(env, 'SELECT * FROM orders WHERE code=?', code);
    if (!o) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    if (url.searchParams.get('check') === '1') o = await syncPayment(env, o);
    const items = await all(env, 'SELECT i.sku, i.name, i.price, i.qty, p.image, p.slug FROM order_items i LEFT JOIN products p ON p.id=i.product_id WHERE order_id=?', o.id);
    const s = await getSettings(env);
    return json({
      code: o.code, status: o.status, status_label: STATUS_LABEL[o.status], payment_status: o.payment_status, payment_label: PAY_LABEL[o.payment_status],
      payment_method: o.payment_method, total: o.total, subtotal: o.subtotal, discount: o.discount, shipping_fee: o.shipping_fee, paid_amount: o.paid_amount,
      payment_code: o.payment_code, payment_qr: o.payment_qr, payment_account: o.payment_account, payment_bank: o.payment_bank, bank_holder: s.payment?.bank?.holder || null,
      manual_payment: o.payment_code === o.code, name: o.name, phone: o.phone.replace(/^(\d{3})\d{4}/, '$1****'), address: o.address, province: o.province,
      shipping_carrier: o.shipping_carrier, shipping_expected: o.shipping_expected, tracking_code: o.tracking_code, tracking_url: o.tracking_url, ship_status_text: o.ship_status_text,
      created_at: o.created_at, expire_minutes: s.payment?.expire_minutes || 1440, items,
    });
  }

  if (p === '/api/geo/cities' && m === 'GET') return json(await listCities(env), 200, { 'cache-control': 'public, max-age=3600' });
  if (p === '/api/geo/districts' && m === 'GET') return json({ items: await listDistricts(env, url.searchParams.get('city') || '') }, 200, { 'cache-control': 'public, max-age=3600' });
  if (p === '/api/geo/wards' && m === 'GET') return json({ items: await listWards(env, url.searchParams.get('district') || '') }, 200, { 'cache-control': 'public, max-age=3600' });

  if ((mm = p.match(/^\/api\/lot\/([A-Za-z0-9-]+)$/)) && m === 'GET') {
    const lot = await getLot(env, mm[1], true);
    if (!lot) throw new HttpError(404, 'Không tìm thấy mã lô');
    return json(lot);
  }

  if (p === '/api/t' && m === 'POST') {
    const b = await readBody(request).catch(() => ({}));
    const evs = (Array.isArray(b) ? b : [b]).slice(0, 20);
    const ua = request.headers.get('user-agent') || '';
    if (/bot|crawl|spider|preview|headless/i.test(ua)) return json({ ok: true });
    const device = /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
    const allowed = new Set(['page_view', 'view_product', 'add_to_cart', 'begin_checkout', 'qr_scan', 'click_channel', 'persona', 'search']);
    const st = evs.filter((e) => allowed.has(e.type)).map((e) => stmt(env, 'INSERT INTO events (sid, type, path, product_id, value, source, medium, campaign, referrer, ref, device) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      String(e.sid || '').slice(0, 40) || null, e.type, String(e.path || '').slice(0, 200), Number(e.product_id) || null, Number(e.value) || null,
      String(e.source || '').slice(0, 60) || null, String(e.medium || '').slice(0, 60) || null, String(e.campaign || '').slice(0, 80) || null,
      String(e.referrer || '').slice(0, 200) || null, String(e.ref || '').slice(0, 20) || null, device));
    if (st.length) ctx?.waitUntil ? ctx.waitUntil(env.DB.batch(st)) : await env.DB.batch(st);
    return json({ ok: true });
  }

  if (p === '/api/contact' && m === 'POST') {
    const b = await readBody(request);
    if (b.website) return json({ ok: true });
    const phone = normPhone(b.phone);
    if (!validPhone(phone)) throw new HttpError(400, 'Số điện thoại chưa đúng');
    if (String(b.message || '').trim().length < 3) throw new HttpError(400, 'Vui lòng nhập nội dung');
    const c = await first(env, 'SELECT id FROM customers WHERE phone=?', phone);
    const topic = ['tu-van', 'khieu-nai', 'doi-tra', 'b2b', 'ctv', 'khac'].includes(b.topic) ? b.topic : 'tu-van';
    await run(env, 'INSERT INTO tickets (customer_id, name, phone, email, topic, message, order_code, channel, priority) VALUES (?,?,?,?,?,?,?,?,?)',
      c?.id || null, String(b.name || '').slice(0, 80), phone, b.email || null, topic, String(b.message).slice(0, 2000), b.order_code || null, 'web',
      topic === 'khieu-nai' || topic === 'doi-tra' ? 'high' : 'normal');
    return json({ ok: true });
  }

  if (p === '/api/goship/webhook' && m === 'POST') return goshipWebhook(request, env, url);
  if (p === '/api/cron' && m === 'POST') {
    if (!env.CRON_KEY || request.headers.get('x-cron-key') !== env.CRON_KEY) throw new HttpError(403, 'forbidden');
    return json(await cronTick(env));
  }
  throw new HttpError(404, 'Không tìm thấy');
}

export async function getLot(env, code, countScan = false) {
  const lot = await first(env, `SELECT l.*, p.name product_name, p.subtitle product_subtitle, p.slug product_slug, p.image product_image, p.price product_price
    FROM lots l LEFT JOIN products p ON p.id=l.product_id WHERE l.code=?`, String(code).toUpperCase());
  if (lot && countScan) await run(env, 'UPDATE lots SET scans=scans+1 WHERE id=?', lot.id);
  return lot;
}

async function goshipWebhook(request, env, url) {
  const raw = await request.text();
  const secret = await getSecret(env, 'goship_client_secret', 'GOSHIP_CLIENT_SECRET');
  const ship = (await getSetting(env, 'shipping', {})) || {};
  const okKey = ship.webhook_key && url.searchParams.get('key') === ship.webhook_key;
  const okSig = await verifyGoshipWebhook(raw, request.headers.get('x-goship-hmac-sha256'), secret);
  if (!okKey && !okSig) return json({ error: 'invalid signature' }, 401);
  const d = parseJson(raw, {});
  const o = await first(env, 'SELECT * FROM orders WHERE code=? OR goship_id=?', d.order_id || '', d.gcode || '');
  if (!o) return json({ ok: true, ignored: true });
  const st = Number(d.status);
  await run(env, `UPDATE orders SET ship_status=?, ship_status_text=?, tracking_code=COALESCE(?, tracking_code), tracking_url=COALESCE(?, tracking_url),
    goship_id=COALESCE(goship_id, ?), shipping_cost=COALESCE(?, shipping_cost), updated_at=datetime('now') WHERE id=?`,
  String(st), d.status_text || GOSHIP_STATUS[st] || null, d.code || null, d.tracking_url || null, d.gcode || null, Number(d.fee) || null, o.id);
  if ([902, 903, 904, 919].includes(st) && ['new', 'confirmed'].includes(o.status)) await setOrderStatus(env, o, 'shipping', 'Goship');
  else if ([905, 913].includes(st) && o.status !== 'completed') await setOrderStatus(env, o, 'completed', 'Goship');
  else if (st === 908 && o.status !== 'returned') await setOrderStatus(env, o, 'returned', 'Goship');
  return json({ ok: true });
}

// ---------------------------------------------------------------- cộng tác viên
async function affApi(request, env, url, p, m) {
  const settings = await getSettings(env);
  const aff = settings.affiliate || {};
  // Đăng ký CTV nay đi qua tài khoản khách: /api/account/register rồi /api/account/affiliate
  if (p === '/register' && m === 'POST') throw new HttpError(410, 'Vui lòng tạo tài khoản khách hàng rồi đăng ký cộng tác viên');
  if (p === '/login' && m === 'POST') {
    const b = await readBody(request);
    const a = await first(env, 'SELECT * FROM affiliates WHERE phone=?', normPhone(b.phone));
    if (!a || !(await verifyPassword(String(b.password || ''), a.pass_hash))) throw new HttpError(401, 'Sai số điện thoại hoặc mật khẩu');
    if (a.status === 'blocked') throw new HttpError(403, 'Tài khoản đang tạm khoá, liên hệ DaLa');
    await run(env, "UPDATE affiliates SET last_login=datetime('now') WHERE id=?", a.id);
    return json({ ok: true }, 200, { 'set-cookie': await createSession(env, 'aff', a.id, request) });
  }
  if (p === '/logout' && m === 'POST') {
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    headers.append('set-cookie', await endSession(env, request, 'aff'));
    headers.append('set-cookie', await endSession(env, request, 'cust'));
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  // Phiên CTV cũ, hoặc tài khoản khách đã đăng ký CTV
  const sess = await getSession(env, request, 'aff');
  const me = sess ? await first(env, 'SELECT * FROM affiliates WHERE id=?', sess.user_id) : await linkedAffiliate(env, request);
  if (!me && p === '/me') return json({ guest: true });
  if (!me || me.status === 'blocked') throw new HttpError(401, 'Vui lòng đăng nhập');
  const tiers = aff.tiers || [];

  if (p === '/me' && m === 'GET') {
    const comms = await all(env, 'SELECT level, amount, status, created_at FROM commissions WHERE affiliate_id=?', me.id);
    const wds = await all(env, 'SELECT * FROM withdrawals WHERE affiliate_id=? ORDER BY id DESC', me.id);
    const month = await first(env, `SELECT IFNULL(SUM(CASE WHEN level=0 THEN base END),0) sales, IFNULL(SUM(amount),0) comm, COUNT(DISTINCT order_id) orders
      FROM commissions WHERE affiliate_id=? AND status!='void' AND strftime('%Y-%m', created_at)=strftime('%Y-%m','now')`, me.id);
    const byLevel = [0, 1, 2].map((l) => ({ level: l, name: LEVEL_NAMES[l], amount: comms.filter((c) => c.level === l && c.status !== 'void').reduce((s, c) => s + c.amount, 0) }));
    const f1 = await first(env, 'SELECT COUNT(*) n FROM affiliates WHERE parent_id=?', me.id);
    const f2 = await first(env, 'SELECT COUNT(*) n FROM affiliates WHERE parent_id IN (SELECT id FROM affiliates WHERE parent_id=?)', me.id);
    const customers = await first(env, 'SELECT COUNT(*) n FROM customers WHERE affiliate_id=?', me.id);
    const clicks = await first(env, "SELECT COUNT(DISTINCT sid) n FROM events WHERE ref=? AND type='page_view' AND ts > datetime('now','-30 days')", me.code);
    const t = tierById(tiers, me.tier);
    const next = [...tiers].sort((a, b) => a.min_sales - b.min_sales).find((x) => x.min_sales > t.min_sales);
    const parent = me.parent_id ? await first(env, 'SELECT name, code FROM affiliates WHERE id=?', me.parent_id) : null;
    return json({
      me: { id: me.id, code: me.code, name: me.name, phone: me.phone, email: me.email, status: me.status, tier: t, province: me.province,
        bank_name: me.bank_name, bank_account: me.bank_account, bank_holder: me.bank_holder, tax_code: me.tax_code, address: me.address, created_at: me.created_at, parent },
      tiers, next_tier: next || null, month, by_level: byLevel, wallet: walletSummary(comms, wds), withdrawals: wds.slice(0, 20),
      team: { f1: f1.n, f2: f2.n }, customers: customers.n, clicks_30d: clicks.n,
      policy: { hold_days: aff.hold_days, min_withdraw: aff.min_withdraw, payout_days: aff.payout_days, cookie_days: aff.cookie_days, buyer_discount_pct: aff.buyer_discount_pct },
    });
  }
  if (p === '/orders' && m === 'GET') {
    const rows = await all(env, `SELECT c.level, c.amount, c.rate, c.base, c.status cstatus, c.available_at, o.code, o.created_at, o.status, o.total,
      substr(o.name,1,1) || '***' AS buyer, a.name AS seller
      FROM commissions c JOIN orders o ON o.id=c.order_id LEFT JOIN affiliates a ON a.id=o.affiliate_id
      WHERE c.affiliate_id=? ORDER BY c.id DESC LIMIT 200`, me.id);
    return json(rows.map((r) => ({ ...r, level_name: LEVEL_NAMES[r.level], status_label: STATUS_LABEL[r.status] })));
  }
  if (p === '/team' && m === 'GET') {
    const f1 = await all(env, `SELECT a.id, a.name, a.code, a.tier, a.created_at,
      (SELECT IFNULL(SUM(base),0) FROM commissions WHERE affiliate_id=a.id AND level=0 AND status!='void' AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')) month_sales,
      (SELECT COUNT(*) FROM affiliates WHERE parent_id=a.id) f2_count
      FROM affiliates a WHERE parent_id=? ORDER BY a.id DESC`, me.id);
    const f2 = f1.length ? await all(env, `SELECT a.name, a.code, a.tier, a.parent_id, a.created_at FROM affiliates a WHERE parent_id IN (${f1.map(() => '?').join(',')}) ORDER BY a.id DESC`, ...f1.map((x) => x.id)) : [];
    return json({ f1: f1.map((x) => ({ ...x, tier_name: tierById(tiers, x.tier).name })), f2: f2.map((x) => ({ ...x, tier_name: tierById(tiers, x.tier).name })) });
  }
  if (p === '/profile' && m === 'PUT') {
    const b = await readBody(request);
    const tax = String(b.tax_code ?? me.tax_code ?? '').replace(/\s/g, '');
    if (tax && !/^\d{10}(\d{2})?$|^\d{10}-\d{3}$/.test(tax)) throw new HttpError(400, 'Mã số thuế cá nhân gồm 10 hoặc 12 chữ số');
    await run(env, 'UPDATE affiliates SET name=COALESCE(?, name), email=?, province=?, address=COALESCE(?, address), bank_name=?, bank_account=?, bank_holder=?, tax_code=? WHERE id=?',
      b.name || null, b.email || null, b.province || null, b.address || null, b.bank_name || null, String(b.bank_account || '').replace(/\s/g, '') || null, String(b.bank_holder || '').toUpperCase() || null, tax || null, me.id);
    if (b.new_password) {
      if (!(await verifyPassword(String(b.password || ''), me.pass_hash))) throw new HttpError(400, 'Mật khẩu hiện tại chưa đúng');
      if (String(b.new_password).length < 6) throw new HttpError(400, 'Mật khẩu mới tối thiểu 6 ký tự');
      const h = await hashPassword(String(b.new_password));
      await run(env, 'UPDATE affiliates SET pass_hash=? WHERE id=?', h, me.id);
      if (me.customer_id) await run(env, 'UPDATE customers SET pass_hash=? WHERE id=? AND pass_hash IS NOT NULL', h, me.customer_id);
    }
    return json({ ok: true });
  }
  if (p === '/withdraw' && m === 'POST') {
    const b = await readBody(request);
    const amount = Math.floor(Number(b.amount) || 0);
    if (!me.bank_account || !me.bank_name || !me.bank_holder) throw new HttpError(400, 'Vui lòng cập nhật tài khoản ngân hàng trước khi rút');
    const comms = await all(env, 'SELECT amount, status FROM commissions WHERE affiliate_id=?', me.id);
    const wds = await all(env, 'SELECT amount, status FROM withdrawals WHERE affiliate_id=?', me.id);
    const w = walletSummary(comms, wds);
    if (amount < (aff.min_withdraw || 0)) throw new HttpError(400, `Số tiền rút tối thiểu ${(aff.min_withdraw || 0).toLocaleString('vi-VN')}đ`);
    if (amount > w.balance) throw new HttpError(400, `Số dư khả dụng chỉ còn ${w.balance.toLocaleString('vi-VN')}đ`);
    await run(env, 'INSERT INTO withdrawals (affiliate_id, amount, bank_name, bank_account, bank_holder, note) VALUES (?,?,?,?,?,?)',
      me.id, amount, me.bank_name, me.bank_account, me.bank_holder, String(b.note || '').slice(0, 200) || null);
    return json({ ok: true });
  }
  throw new HttpError(404, 'Không tìm thấy');
}

// ---------------------------------------------------------------- quản trị
async function adminApi(request, env, url, p, m) {
  if (p === '/login' && m === 'POST') {
    await ensureAdmin(env);
    const b = await readBody(request);
    const u = await first(env, 'SELECT * FROM admins WHERE username=? AND active=1', String(b.username || '').trim().toLowerCase());
    if (!u || !(await verifyPassword(String(b.password || ''), u.pass_hash))) throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
    return json({ ok: true }, 200, { 'set-cookie': await createSession(env, 'admin', u.id, request) });
  }
  if (p === '/logout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': await endSession(env, request, 'admin') });
  const sess = await getSession(env, request, 'admin');
  if (!sess) throw new HttpError(401, 'Vui lòng đăng nhập');
  const user = await first(env, 'SELECT id, username, name, role FROM admins WHERE id=? AND active=1', sess.user_id);
  if (!user) throw new HttpError(401, 'Vui lòng đăng nhập');
  const need = (role) => { if (ROLE_RANK[user.role] < ROLE_RANK[role]) throw new HttpError(403, 'Bạn không có quyền thao tác này'); };
  if (m !== 'GET') need('ops');
  const q = url.searchParams;
  let mm;

  if (p === '/me') {
    const defaultPw = !env.ADMIN_PASSWORD && user.username === 'admin' && (await verifyPassword('dala12345', (await first(env, 'SELECT pass_hash FROM admins WHERE id=?', user.id)).pass_hash));
    return json({ ...user, default_password: defaultPw });
  }
  if (p === '/dashboard') return json(await dashboard(env, Number(q.get('days')) || 30));
  if (p === '/analytics') return json(await analytics(env, Number(q.get('days')) || 30));
  if (p === '/cron' && m === 'POST') return json(await cronTick(env));

  // ---- đơn hàng
  if (p === '/orders' && m === 'GET') {
    const w = []; const a = [];
    if (q.get('status')) { w.push('o.status=?'); a.push(q.get('status')); }
    if (q.get('channel')) { w.push('o.channel=?'); a.push(q.get('channel')); }
    if (q.get('pay')) { w.push('o.payment_status=?'); a.push(q.get('pay')); }
    if (q.get('from')) { w.push('o.created_at>=?'); a.push(q.get('from') + ' 00:00:00'); }
    if (q.get('to')) { w.push('o.created_at<=?'); a.push(q.get('to') + ' 23:59:59'); }
    if (q.get('q')) { w.push('(o.code LIKE ? OR o.phone LIKE ? OR o.name LIKE ? OR o.external_id LIKE ?)'); const s = `%${q.get('q')}%`; a.push(s, s, s, s); }
    const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const rows = await all(env, `SELECT o.*, af.code aff_code, af.name aff_name FROM orders o LEFT JOIN affiliates af ON af.id=o.affiliate_id ${where} ORDER BY o.id DESC LIMIT 300`, ...a);
    if (q.get('format') === 'csv') {
      return new Response(toCsv(rows, [
        { label: 'Mã đơn', key: 'code' }, { label: 'Ngày', key: 'created_at' }, { label: 'Kênh', get: (r) => CHANNEL_LABEL[r.channel] }, { label: 'Mã ngoài', key: 'external_id' },
        { label: 'Khách', key: 'name' }, { label: 'SĐT', key: 'phone' }, { label: 'Địa chỉ', get: (r) => [r.address, r.ward, r.district, r.province].filter(Boolean).join(', ') },
        { label: 'Tạm tính', key: 'subtotal' }, { label: 'Giảm', key: 'discount' }, { label: 'Phí ship', key: 'shipping_fee' }, { label: 'Tổng', key: 'total' },
        { label: 'Thanh toán', get: (r) => (r.payment_method === 'cod' ? 'COD' : r.payment_method) + ' · ' + PAY_LABEL[r.payment_status] },
        { label: 'Trạng thái', get: (r) => STATUS_LABEL[r.status] }, { label: 'CTV', key: 'aff_code' }, { label: 'Vận chuyển', key: 'shipping_carrier' }, { label: 'Mã vận đơn', key: 'tracking_code' },
      ]), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="don-hang-${nowSql().slice(0, 10)}.csv"` } });
    }
    return json(rows);
  }
  if ((mm = p.match(/^\/orders\/(\d+)$/)) && m === 'GET') {
    const o = await first(env, 'SELECT o.*, af.code aff_code, af.name aff_name FROM orders o LEFT JOIN affiliates af ON af.id=o.affiliate_id WHERE o.id=?', Number(mm[1]));
    if (!o) throw new HttpError(404, 'Không tìm thấy đơn');
    const items = await all(env, 'SELECT * FROM order_items WHERE order_id=?', o.id);
    const comms = await all(env, 'SELECT c.*, a.name, a.code FROM commissions c JOIN affiliates a ON a.id=c.affiliate_id WHERE order_id=? ORDER BY level', o.id);
    return json({ ...o, items, commissions: comms.map((c) => ({ ...c, level_name: LEVEL_NAMES[c.level] })), view_token: await orderToken(env, o.code) });
  }
  if ((mm = p.match(/^\/orders\/(\d+)$/)) && m === 'PUT') {
    const b = await readBody(request);
    let o = await first(env, 'SELECT * FROM orders WHERE id=?', Number(mm[1]));
    if (!o) throw new HttpError(404, 'Không tìm thấy đơn');
    await run(env, `UPDATE orders SET tracking_code=?, shipping_carrier=?, admin_note=?, note=?, address=?, updated_at=datetime('now') WHERE id=?`,
      b.tracking_code ?? o.tracking_code, b.shipping_carrier ?? o.shipping_carrier, b.admin_note ?? o.admin_note, b.note ?? o.note, b.address ?? o.address, o.id);
    if (b.affiliate_code !== undefined && b.affiliate_code !== (o.affiliate_id ? (await first(env, 'SELECT code FROM affiliates WHERE id=?', o.affiliate_id))?.code : '')) {
      const a = b.affiliate_code ? await first(env, 'SELECT id FROM affiliates WHERE code=?', String(b.affiliate_code).toUpperCase()) : null;
      if (b.affiliate_code && !a) throw new HttpError(400, 'Không tìm thấy mã CTV');
      await run(env, "DELETE FROM commissions WHERE order_id=? AND status!='available'", o.id);
      await run(env, "UPDATE orders SET affiliate_id=?, ref_source='admin' WHERE id=?", a?.id || null, o.id);
      o = await first(env, 'SELECT * FROM orders WHERE id=?', o.id);
      if (a && (o.payment_status === 'paid' || o.payment_method !== 'sepay')) await ensureCommissions(env, o);
      if (o.status === 'completed') await run(env, "UPDATE commissions SET available_at=datetime('now','+7 days') WHERE order_id=? AND status='pending' AND available_at IS NULL", o.id);
    }
    if (b.status && b.status !== o.status) o = await setOrderStatus(env, o, b.status, user.username);
    if (b.payment_status === 'paid' && o.payment_status !== 'paid') o = await markPaid(env, o, o.total, user.username);
    return json(o);
  }
  if ((mm = p.match(/^\/orders\/(\d+)\/sync-payment$/)) && m === 'POST') {
    const o = await first(env, 'SELECT * FROM orders WHERE id=?', Number(mm[1]));
    return json(await syncPayment(env, o));
  }
  if ((mm = p.match(/^\/orders\/(\d+)\/rates$/)) && m === 'GET') {
    const o = await first(env, 'SELECT * FROM orders WHERE id=?', Number(mm[1]));
    const parcel = parseJson(o.parcel_dims, null) || { weight: o.parcel_weight || 500, length: 20, width: 15, height: 10, fragile: !!o.fragile };
    const cod = o.payment_method === 'cod' && o.payment_status !== 'paid' ? o.total : 0;
    return json(await quoteShipping(env, parcel, { city: o.city_code, district: o.district_code, ward: o.ward_code, province: o.province }, { cod, amount: o.subtotal }));
  }
  if ((mm = p.match(/^\/orders\/(\d+)\/shipment$/)) && m === 'POST') {
    const b = await readBody(request);
    const o = await first(env, 'SELECT * FROM orders WHERE id=?', Number(mm[1]));
    if (!o.district_code) throw new HttpError(400, 'Đơn thiếu mã quận/huyện Goship, không tạo vận đơn tự động được');
    if (!b.rate_id || b.rate_id === 'fallback') throw new HttpError(400, 'Chọn một hãng vận chuyển từ Goship');
    const d = await createShipment(env, o, b.rate_id);
    await run(env, `UPDATE orders SET goship_id=?, tracking_code=?, shipping_carrier=?, shipping_cost=?, ship_status=?, ship_status_text=?, updated_at=datetime('now') WHERE id=?`,
      d.id || null, d.tracking_number || null, d.carrier || o.shipping_carrier, Number(d.fee) || null, String(d.shipment_status || ''), d.shipment_status_txt || null, o.id);
    let o2 = await first(env, 'SELECT * FROM orders WHERE id=?', o.id);
    if (['new', 'confirmed'].includes(o2.status)) o2 = await setOrderStatus(env, o2, 'shipping', user.username);
    return json({ ok: true, shipment: d, order: o2 });
  }
  if (p === '/orders' && m === 'POST') return json(await manualOrder(env, await readBody(request), user));
  if (p === '/orders/import' && m === 'POST') return json(await importOrders(env, await readBody(request), user));

  // ---- sản phẩm
  if (p === '/products' && m === 'GET') {
    const [products, flash] = await Promise.all([loadProducts(env, { all: true }), activeFlash(env)]);
    const sold = await all(env, `SELECT i.sku, SUM(i.qty) qty, SUM(i.qty*i.price) revenue FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE o.status NOT IN ('cancelled','returned') AND o.created_at > datetime('now','-30 days') GROUP BY i.sku`);
    const soldMap = new Map(sold.map((s) => [s.sku, s]));
    return json(decorate(products, flash).map((p2) => ({ ...p2, sold_30d: soldMap.get(p2.sku)?.qty || 0, revenue_30d: soldMap.get(p2.sku)?.revenue || 0 })));
  }
  if ((p === '/products' && m === 'POST') || ((mm = p.match(/^\/products\/(\d+)$/)) && m === 'PUT')) {
    const b = await readBody(request);
    const f = productFields(b);
    if (!f.sku || !f.name || !(f.price >= 0)) throw new HttpError(400, 'Cần SKU, tên và giá bán');
    f.slug = slugify(f.slug || `${f.name} ${f.weight || ''}`);
    const cols = Object.keys(f);
    if (mm) {
      await run(env, `UPDATE products SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE id=?`, ...Object.values(f), Number(mm[1]));
      return json(parseProduct(await first(env, 'SELECT * FROM products WHERE id=?', Number(mm[1]))));
    }
    const r = await run(env, `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...Object.values(f));
    return json(parseProduct(await first(env, 'SELECT * FROM products WHERE id=?', r.meta.last_row_id)));
  }

  // ---- flash sale
  if (p === '/flash-sales' && m === 'GET') {
    const sales = await all(env, 'SELECT * FROM flash_sales ORDER BY starts_at DESC LIMIT 50');
    const items = await all(env, 'SELECT f.*, p.name, p.subtitle, p.sku, p.price, p.image FROM flash_sale_items f JOIN products p ON p.id=f.product_id');
    return json(sales.map((s) => ({ ...s, items: items.filter((i) => i.sale_id === s.id) })));
  }
  if ((p === '/flash-sales' && m === 'POST') || ((mm = p.match(/^\/flash-sales\/(\d+)$/)) && m === 'PUT')) {
    const b = await readBody(request);
    const starts = toSqlTime(b.starts_at), ends = toSqlTime(b.ends_at);
    if (!b.name || !starts || !ends || ends <= starts) throw new HttpError(400, 'Cần tên, thời gian bắt đầu và kết thúc hợp lệ');
    let id = mm ? Number(mm[1]) : null;
    if (id) await run(env, 'UPDATE flash_sales SET name=?, starts_at=?, ends_at=?, active=? WHERE id=?', b.name, starts, ends, b.active === false ? 0 : 1, id);
    else id = (await run(env, 'INSERT INTO flash_sales (name, starts_at, ends_at, active) VALUES (?,?,?,?)', b.name, starts, ends, b.active === false ? 0 : 1)).meta.last_row_id;
    const items = Array.isArray(b.items) ? b.items : [];
    const keep = items.map((i) => Number(i.product_id)).filter(Boolean);
    const st = [stmt(env, `DELETE FROM flash_sale_items WHERE sale_id=? ${keep.length ? `AND product_id NOT IN (${keep.map(() => '?').join(',')})` : ''}`, id, ...keep)];
    for (const i of items) {
      if (!i.product_id || !(Number(i.sale_price) > 0)) continue;
      st.push(stmt(env, `INSERT INTO flash_sale_items (sale_id, product_id, sale_price, quota, per_order) VALUES (?,?,?,?,?)
        ON CONFLICT(sale_id, product_id) DO UPDATE SET sale_price=excluded.sale_price, quota=excluded.quota, per_order=excluded.per_order`,
      id, Number(i.product_id), Math.round(Number(i.sale_price)), Math.max(0, Number(i.quota) || 0), Math.max(1, Number(i.per_order) || 3)));
    }
    await env.DB.batch(st);
    return json({ ok: true, id });
  }
  if ((mm = p.match(/^\/flash-sales\/(\d+)$/)) && m === 'DELETE') {
    await env.DB.batch([stmt(env, 'DELETE FROM flash_sale_items WHERE sale_id=?', Number(mm[1])), stmt(env, 'DELETE FROM flash_sales WHERE id=?', Number(mm[1]))]);
    return json({ ok: true });
  }

  // ---- voucher
  if (p === '/vouchers' && m === 'GET') return json(await all(env, 'SELECT * FROM vouchers ORDER BY created_at DESC'));
  if (p === '/vouchers' && m === 'POST') {
    const b = await readBody(request);
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !['pct', 'fixed', 'freeship'].includes(b.type)) throw new HttpError(400, 'Cần mã và loại giảm giá');
    if (await first(env, 'SELECT 1 FROM affiliates WHERE code=?', code)) throw new HttpError(400, 'Mã trùng với mã cộng tác viên');
    await run(env, `INSERT INTO vouchers (code, type, value, min_order, max_discount, usage_limit, first_order_only, starts_at, ends_at, note, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(code) DO UPDATE SET type=excluded.type, value=excluded.value, min_order=excluded.min_order, max_discount=excluded.max_discount, usage_limit=excluded.usage_limit,
      first_order_only=excluded.first_order_only, starts_at=excluded.starts_at, ends_at=excluded.ends_at, note=excluded.note, active=excluded.active`,
    code, b.type, Number(b.value) || 0, Number(b.min_order) || 0, Number(b.max_discount) || null, Number(b.usage_limit) || null, b.first_order_only ? 1 : 0,
    toSqlTime(b.starts_at), toSqlTime(b.ends_at), b.note || null, b.active === false ? 0 : 1);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/vouchers\/([A-Z0-9]+)$/)) && m === 'DELETE') { await run(env, 'DELETE FROM vouchers WHERE code=?', mm[1]); return json({ ok: true }); }

  // ---- khách hàng (CRM)
  if (p === '/customers' && m === 'GET') {
    const seg = q.get('segment');
    const w = []; const a = [];
    if (q.get('q')) { w.push('(c.name LIKE ? OR c.phone LIKE ? OR c.tags LIKE ?)'); const s = `%${q.get('q')}%`; a.push(s, s, s); }
    if (seg === 'new') w.push("c.orders_count=1 AND c.last_order_at > datetime('now','-30 days')");
    if (seg === 'repeat') w.push('c.orders_count>=2');
    if (seg === 'vip') w.push('c.total_spent>=1000000');
    if (seg === 'risk') w.push("c.orders_count>=1 AND c.last_order_at < datetime('now','-60 days')");
    if (seg === 'lead') w.push('c.orders_count=0');
    if (seg === 'ctv') w.push('c.affiliate_id IS NOT NULL');
    const rows = await all(env, `SELECT c.*, a.code aff_code FROM customers c LEFT JOIN affiliates a ON a.id=c.affiliate_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY c.last_order_at DESC NULLS LAST, c.id DESC LIMIT 500`, ...a);
    const out = rows.map((c) => ({ ...c, segment: segmentOf(c) }));
    if (q.get('format') === 'csv') {
      return new Response(toCsv(out, [{ label: 'Tên', key: 'name' }, { label: 'SĐT', key: 'phone' }, { label: 'Tỉnh', key: 'province' }, { label: 'Nhóm', key: 'segment' },
        { label: 'Số đơn', key: 'orders_count' }, { label: 'Tổng chi', key: 'total_spent' }, { label: 'Đơn gần nhất', key: 'last_order_at' }, { label: 'CTV', key: 'aff_code' }, { label: 'Tag', key: 'tags' }]),
      { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="khach-hang.csv"' } });
    }
    return json(out);
  }
  if ((mm = p.match(/^\/customers\/(\d+)$/)) && m === 'GET') {
    const id = Number(mm[1]);
    const c = await first(env, 'SELECT c.*, a.code aff_code, a.name aff_name FROM customers c LEFT JOIN affiliates a ON a.id=c.affiliate_id WHERE c.id=?', id);
    if (!c) throw new HttpError(404, 'Không tìm thấy khách');
    const [orders, notes, tasks, tickets, fav] = await Promise.all([
      all(env, 'SELECT id, code, created_at, total, status, payment_status, channel FROM orders WHERE customer_id=? ORDER BY id DESC', id),
      all(env, 'SELECT * FROM notes WHERE customer_id=? ORDER BY id DESC', id),
      all(env, 'SELECT * FROM care_tasks WHERE customer_id=? ORDER BY due_at DESC', id),
      all(env, 'SELECT * FROM tickets WHERE customer_id=? OR phone=? ORDER BY id DESC', id, c.phone),
      all(env, `SELECT i.name, SUM(i.qty) qty FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.customer_id=? AND o.status NOT IN ('cancelled','returned') GROUP BY i.name ORDER BY qty DESC LIMIT 5`, id),
    ]);
    return json({ ...c, segment: segmentOf(c), orders, notes, tasks, tickets, favorites: fav });
  }
  if ((mm = p.match(/^\/customers\/(\d+)$/)) && m === 'PUT') {
    const b = await readBody(request);
    await run(env, 'UPDATE customers SET name=?, email=?, address=?, province=?, persona=?, tags=?, note=? WHERE id=?', b.name || null, b.email || null, b.address || null,
      b.province || null, b.persona || null, b.tags || null, b.note || null, Number(mm[1]));
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/customers\/(\d+)\/notes$/)) && m === 'POST') {
    const b = await readBody(request);
    if (!String(b.body || '').trim()) throw new HttpError(400, 'Nội dung trống');
    await run(env, 'INSERT INTO notes (customer_id, author, body) VALUES (?,?,?)', Number(mm[1]), user.name || user.username, String(b.body).slice(0, 2000));
    return json({ ok: true });
  }

  // ---- chăm sóc (CSM): việc cần làm + phiếu hỗ trợ
  if (p === '/tasks' && m === 'GET') {
    const st = q.get('status') || 'open';
    const due = q.get('due');
    const rows = await all(env, `SELECT t.*, c.name, c.phone, c.orders_count, c.total_spent, o.code order_code FROM care_tasks t LEFT JOIN customers c ON c.id=t.customer_id
      LEFT JOIN orders o ON o.id=t.order_id WHERE t.status=? ${due === 'today' ? "AND t.due_at <= datetime('now','+1 day')" : ''} ORDER BY t.due_at LIMIT 300`, st);
    return json(rows);
  }
  if (p === '/tasks' && m === 'POST') {
    const b = await readBody(request);
    if (!b.title) throw new HttpError(400, 'Cần nội dung việc');
    await run(env, 'INSERT INTO care_tasks (customer_id, type, title, due_at, assignee) VALUES (?,?,?,?,?)', Number(b.customer_id) || null, b.type || 'custom', b.title,
      toSqlTime(b.due_at) || nowSql(), b.assignee || user.username);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/tasks\/(\d+)$/)) && m === 'PUT') {
    const b = await readBody(request);
    await run(env, `UPDATE care_tasks SET status=?, result=?, assignee=COALESCE(?, assignee), due_at=COALESCE(?, due_at), done_at=CASE WHEN ?='open' THEN NULL ELSE datetime('now') END WHERE id=?`,
      b.status || 'done', b.result || null, b.assignee || null, toSqlTime(b.due_at), b.status || 'done', Number(mm[1]));
    return json({ ok: true });
  }
  if (p === '/tickets' && m === 'GET') {
    const st = q.get('status');
    return json(await all(env, `SELECT * FROM tickets ${st ? 'WHERE status=?' : ''} ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END, id DESC LIMIT 300`, ...(st ? [st] : [])));
  }
  if (p === '/tickets' && m === 'POST') {
    const b = await readBody(request);
    const phone = normPhone(b.phone);
    const c = phone ? await first(env, 'SELECT id FROM customers WHERE phone=?', phone) : null;
    await run(env, 'INSERT INTO tickets (customer_id, name, phone, topic, message, order_code, channel, priority, assignee) VALUES (?,?,?,?,?,?,?,?,?)',
      c?.id || null, b.name || null, phone || null, b.topic || 'tu-van', b.message || '', b.order_code || null, b.channel || 'zalo', b.priority || 'normal', user.username);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/tickets\/(\d+)$/)) && m === 'PUT') {
    const b = await readBody(request);
    await run(env, "UPDATE tickets SET status=COALESCE(?, status), priority=COALESCE(?, priority), assignee=COALESCE(?, assignee), reply=COALESCE(?, reply), updated_at=datetime('now') WHERE id=?",
      b.status || null, b.priority || null, b.assignee || null, b.reply ?? null, Number(mm[1]));
    return json({ ok: true });
  }

  // ---- cộng tác viên
  if (p === '/affiliates' && m === 'GET') {
    const tiers = (await getSetting(env, 'affiliate', {})).tiers || [];
    const w = []; const a = [];
    if (q.get('status')) { w.push('a.status=?'); a.push(q.get('status')); }
    if (q.get('q')) { w.push('(a.name LIKE ? OR a.phone LIKE ? OR a.code LIKE ?)'); const s = `%${q.get('q')}%`; a.push(s, s, s); }
    const rows = await all(env, `SELECT a.id, a.code, a.name, a.phone, a.tier, a.tier_locked, a.status, a.province, a.parent_id, a.created_at, a.last_login, p.code parent_code,
      (SELECT COUNT(*) FROM affiliates x WHERE x.parent_id=a.id) f1,
      (SELECT IFNULL(SUM(base),0) FROM commissions WHERE affiliate_id=a.id AND level=0 AND status!='void' AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')) month_sales,
      (SELECT IFNULL(SUM(base),0) FROM commissions WHERE affiliate_id=a.id AND level=0 AND status!='void') total_sales,
      (SELECT IFNULL(SUM(amount),0) FROM commissions WHERE affiliate_id=a.id AND status='pending') pending,
      (SELECT IFNULL(SUM(amount),0) FROM commissions WHERE affiliate_id=a.id AND status='available') - (SELECT IFNULL(SUM(amount),0) FROM withdrawals WHERE affiliate_id=a.id AND status!='rejected') balance
      FROM affiliates a LEFT JOIN affiliates p ON p.id=a.parent_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY month_sales DESC, a.id DESC LIMIT 500`, ...a);
    return json({ tiers, rows: rows.map((r) => ({ ...r, tier_name: tierById(tiers, r.tier)?.name })) });
  }
  if ((mm = p.match(/^\/affiliates\/(\d+)$/)) && m === 'GET') {
    const id = Number(mm[1]);
    const a = await first(env, 'SELECT a.*, p.code parent_code, p.name parent_name FROM affiliates a LEFT JOIN affiliates p ON p.id=a.parent_id WHERE a.id=?', id);
    if (!a) throw new HttpError(404, 'Không tìm thấy');
    delete a.pass_hash;
    const [comms, wds, f1, f2, customers] = await Promise.all([
      all(env, 'SELECT c.*, o.code, o.status order_status FROM commissions c JOIN orders o ON o.id=c.order_id WHERE c.affiliate_id=? ORDER BY c.id DESC LIMIT 200', id),
      all(env, 'SELECT * FROM withdrawals WHERE affiliate_id=? ORDER BY id DESC', id),
      all(env, 'SELECT id, code, name, tier, status, created_at FROM affiliates WHERE parent_id=?', id),
      all(env, 'SELECT id, code, name, tier, status, parent_id FROM affiliates WHERE parent_id IN (SELECT id FROM affiliates WHERE parent_id=?)', id),
      first(env, 'SELECT COUNT(*) n, IFNULL(SUM(total_spent),0) spent FROM customers WHERE affiliate_id=?', id),
    ]);
    return json({ ...a, commissions: comms.map((c) => ({ ...c, level_name: LEVEL_NAMES[c.level] })), withdrawals: wds, f1, f2, customers, wallet: walletSummary(comms, wds) });
  }
  if ((mm = p.match(/^\/affiliates\/(\d+)$/)) && m === 'PUT') {
    const b = await readBody(request);
    const id = Number(mm[1]);
    let parentId;
    if (b.parent_code !== undefined) {
      const par = b.parent_code ? await first(env, 'SELECT id, parent_id FROM affiliates WHERE code=?', String(b.parent_code).toUpperCase()) : null;
      if (b.parent_code && !par) throw new HttpError(400, 'Không tìm thấy mã người giới thiệu');
      if (par && (par.id === id || par.parent_id === id)) throw new HttpError(400, 'Không thể đặt cấp dưới làm người giới thiệu');
      parentId = par?.id ?? null;
    }
    await run(env, `UPDATE affiliates SET status=COALESCE(?, status), tier=COALESCE(?, tier), tier_locked=COALESCE(?, tier_locked), admin_note=COALESCE(?, admin_note),
      parent_id=CASE WHEN ? THEN ? ELSE parent_id END WHERE id=?`,
    b.status || null, b.tier ? Number(b.tier) : null, b.tier_locked === undefined ? null : b.tier_locked ? 1 : 0, b.admin_note ?? null, parentId !== undefined ? 1 : 0, parentId ?? null, id);
    if (!b.tier_locked) await recomputeTier(env, id);
    return json({ ok: true });
  }
  if (p === '/commissions' && m === 'GET') {
    const st = q.get('status');
    const rows = await all(env, `SELECT c.*, a.code, a.name, o.code order_code, o.status order_status FROM commissions c JOIN affiliates a ON a.id=c.affiliate_id JOIN orders o ON o.id=c.order_id
      ${st ? 'WHERE c.status=?' : ''} ORDER BY c.id DESC LIMIT 500`, ...(st ? [st] : []));
    return json(rows.map((c) => ({ ...c, level_name: LEVEL_NAMES[c.level] })));
  }
  if (p === '/withdrawals' && m === 'GET') {
    const st = q.get('status');
    return json(await all(env, `SELECT w.*, a.code, a.name, a.phone FROM withdrawals w JOIN affiliates a ON a.id=w.affiliate_id ${st ? 'WHERE w.status=?' : ''} ORDER BY w.id DESC LIMIT 300`, ...(st ? [st] : [])));
  }
  if ((mm = p.match(/^\/withdrawals\/(\d+)$/)) && m === 'PUT') {
    need('admin');
    const b = await readBody(request);
    if (!['approved', 'paid', 'rejected'].includes(b.status)) throw new HttpError(400, 'Trạng thái không hợp lệ');
    const w = await first(env, 'SELECT * FROM withdrawals WHERE id=?', Number(mm[1]));
    if (!w) throw new HttpError(404, 'Không tìm thấy');
    if (w.status === 'paid' || w.status === 'rejected') throw new HttpError(400, 'Lệnh rút đã xử lý xong');
    await run(env, "UPDATE withdrawals SET status=?, admin_note=?, processed_by=?, processed_at=datetime('now') WHERE id=?", b.status, b.admin_note || null, user.username, w.id);
    return json({ ok: true });
  }

  // ---- truy xuất QR theo lô
  if (p === '/lots' && m === 'GET') return json(await all(env, 'SELECT l.*, p.name product_name, p.subtitle product_subtitle FROM lots l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.id DESC'));
  if ((p === '/lots' && m === 'POST') || ((mm = p.match(/^\/lots\/(\d+)$/)) && m === 'PUT')) {
    const b = await readBody(request);
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!code) throw new HttpError(400, 'Cần mã lô');
    const f = [code, Number(b.product_id) || null, b.farm || null, b.farmer || null, b.region || null, b.farm_code || null, b.harvest_date || null, b.process_date || null,
      b.expiry_date || null, b.lab_summary || null, b.lab_url || null, b.video_url || null, b.photo_url || null, b.note || null];
    if (mm) await run(env, 'UPDATE lots SET code=?, product_id=?, farm=?, farmer=?, region=?, farm_code=?, harvest_date=?, process_date=?, expiry_date=?, lab_summary=?, lab_url=?, video_url=?, photo_url=?, note=? WHERE id=?', ...f, Number(mm[1]));
    else await run(env, 'INSERT INTO lots (code, product_id, farm, farmer, region, farm_code, harvest_date, process_date, expiry_date, lab_summary, lab_url, video_url, photo_url, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ...f);
    return json({ ok: true });
  }

  // ---- bài viết (SEO)
  if (p === '/posts' && m === 'GET') return json(await all(env, 'SELECT * FROM posts ORDER BY id DESC'));
  if ((p === '/posts' && m === 'POST') || ((mm = p.match(/^\/posts\/(\d+)$/)) && m === 'PUT')) {
    const b = await readBody(request);
    if (!b.title) throw new HttpError(400, 'Cần tiêu đề');
    const f = [slugify(b.slug || b.title), b.title, b.excerpt || null, b.body || null, b.cover || null, b.seo_title || null, b.seo_desc || null, b.published === false ? 0 : 1];
    if (mm) await run(env, 'UPDATE posts SET slug=?, title=?, excerpt=?, body=?, cover=?, seo_title=?, seo_desc=?, published=? WHERE id=?', ...f, Number(mm[1]));
    else await run(env, 'INSERT INTO posts (slug, title, excerpt, body, cover, seo_title, seo_desc, published) VALUES (?,?,?,?,?,?,?,?)', ...f);
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/posts\/(\d+)$/)) && m === 'DELETE') { await run(env, 'DELETE FROM posts WHERE id=?', Number(mm[1])); return json({ ok: true }); }
  if (p === '/seo-audit' && m === 'GET') return json(await seoAudit(env, url));

  // ---- cài đặt, tích hợp
  if (p === '/settings' && m === 'GET') {
    const s = await getSettings(env);
    const secrets = {};
    for (const k of SECRET_KEYS) {
      const v = await getSetting(env, k, null);
      secrets[k.replace('secret:', '')] = v ? '••••' + String(v).slice(-4) : null;
    }
    const tc = await thuchiConfig(env); const gc = await goshipConfig(env); const oc = await otpConfig(env);
    return json({ ...s, secrets, status: { thuchi: tc.enabled, goship: gc.enabled, otp: oc.ready }, webhook_url: `${url.origin}/api/goship/webhook` });
  }
  if (p === '/settings' && m === 'PUT') {
    need('admin');
    const b = await readBody(request);
    for (const k of ['shop', 'shipping', 'payment', 'affiliate', 'seo', 'auth']) if (b[k] && typeof b[k] === 'object') await setSetting(env, k, b[k]);
    return json({ ok: true });
  }
  if (p === '/settings/secret' && m === 'POST') {
    need('admin');
    const b = await readBody(request);
    if (!SECRET_KEYS.includes('secret:' + b.key)) throw new HttpError(400, 'Khoá không hợp lệ');
    if (b.value) await setSetting(env, 'secret:' + b.key, String(b.value).trim());
    else await run(env, 'DELETE FROM settings WHERE key=?', 'secret:' + b.key);
    return json({ ok: true });
  }
  if (p === '/integrations/thuchi/test' && m === 'POST') return json(await testConnection(env));
  if (p === '/integrations/otp/test' && m === 'POST') {
    need('admin');
    const b = await readBody(request);
    return json(await sendOtp(env, { phone: b.phone, purpose: 'test', ip: request.headers.get('cf-connecting-ip'), host: url.hostname, skipLimits: true }));
  }
  if (p === '/otp-log' && m === 'GET') {
    need('admin');
    return json(await all(env, `SELECT id, phone, purpose, channel, provider, status, error, attempts, created_at, verified_at FROM otp_codes ORDER BY id DESC LIMIT 200`));
  }
  if (p === '/integrations/goship/login' && m === 'POST') { need('admin'); await goshipLogin(env, await readBody(request)); return json({ ok: true }); }
  if (p === '/integrations/goship/test' && m === 'POST') {
    const c = await listCities(env);
    if (c.source !== 'goship') throw new HttpError(400, 'Chưa có token Goship');
    await run(env, "DELETE FROM geo_cache WHERE key='cities'");
    const fresh = await listCities(env);
    return json({ ok: true, cities: fresh.items.length });
  }
  if (p === '/shipping/quote' && m === 'POST') {
    const b = await readBody(request);
    const ship = (await getSetting(env, 'shipping', {})) || {};
    const prods = await loadProducts(env, { all: true });
    const bySku = new Map(prods.map((x) => [x.sku, x]));
    const expand = [];
    for (const i of b.items || []) {
      const pr = bySku.get(String(i.sku || '').toUpperCase()); if (!pr) continue;
      if (pr.kind === 'combo' && pr.combo_items?.length && !pr.weight_g) pr.combo_items.forEach((c) => bySku.get(c.sku) && expand.push({ ...bySku.get(c.sku), qty: c.qty * (Number(i.qty) || 1) }));
      else expand.push({ ...pr, qty: Number(i.qty) || 1 });
    }
    const parcel = buildParcel(expand, ship);
    return json({ parcel, options: await quoteShipping(env, parcel, b.to || {}, { cod: b.cod || 0, amount: b.amount || 0 }) });
  }

  // ---- người dùng quản trị
  if (p === '/users' && m === 'GET') { need('admin'); return json(await all(env, 'SELECT id, username, name, role, active, created_at FROM admins ORDER BY id')); }
  if (p === '/users' && m === 'POST') {
    need('admin');
    const b = await readBody(request);
    const username = String(b.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username) || String(b.password || '').length < 8) throw new HttpError(400, 'Tên đăng nhập 3–30 ký tự, mật khẩu tối thiểu 8 ký tự');
    await run(env, 'INSERT INTO admins (username, name, pass_hash, role) VALUES (?,?,?,?)', username, b.name || username, await hashPassword(b.password), ROLE_RANK[b.role] ? b.role : 'ops');
    return json({ ok: true });
  }
  if ((mm = p.match(/^\/users\/(\d+)$/)) && m === 'PUT') {
    const b = await readBody(request);
    const id = Number(mm[1]);
    if (id !== user.id) need('admin');
    if (b.password) {
      if (String(b.password).length < 8) throw new HttpError(400, 'Mật khẩu tối thiểu 8 ký tự');
      await run(env, 'UPDATE admins SET pass_hash=? WHERE id=?', await hashPassword(b.password), id);
    }
    if (user.role === 'admin' && id !== user.id) await run(env, 'UPDATE admins SET role=COALESCE(?, role), active=COALESCE(?, active), name=COALESCE(?, name) WHERE id=?', b.role || null, b.active === undefined ? null : b.active ? 1 : 0, b.name || null, id);
    return json({ ok: true });
  }
  throw new HttpError(404, 'Không tìm thấy API');
}

// ---------------------------------------------------------------- helpers quản trị
function toSqlTime(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return nowSql(d);
}

function segmentOf(c) {
  if (!c.orders_count) return 'Tiềm năng';
  const last = c.last_order_at ? new Date(c.last_order_at.replace(' ', 'T') + 'Z') : null;
  const days = last ? (Date.now() - last.getTime()) / 86400e3 : 999;
  if (c.total_spent >= 1000000) return days > 60 ? 'VIP cần giữ chân' : 'VIP';
  if (days > 60) return 'Có nguy cơ rời bỏ';
  if (c.orders_count >= 2) return 'Mua lại';
  return 'Khách mới';
}

function productFields(b) {
  const arr = (v) => (Array.isArray(v) ? v : String(v || '').split('\n').map((x) => x.trim()).filter(Boolean));
  const num = (v) => (v === '' || v == null ? null : Math.round(Number(v)));
  let combo = b.combo_items;
  if (typeof combo === 'string') combo = combo.trim() ? combo.split(/[,\n]/).map((x) => { const [sku, qty] = x.trim().split(/[x×*: ]+/); return { sku: sku.toUpperCase(), qty: Number(qty) || 1 }; }) : null;
  return {
    sku: String(b.sku || '').toUpperCase().trim(), slug: b.slug || '', name: String(b.name || '').trim(), subtitle: b.subtitle || null, line: b.line || 'khac', kind: b.kind || 'retail',
    price: num(b.price), compare_price: num(b.compare_price), wholesale_price: num(b.wholesale_price), cost: num(b.cost), stock: num(b.stock) ?? 0,
    image: b.image || null, image_bg: b.image_bg || b.image || null, short_desc: b.short_desc || null, story: b.story || null, benefits: JSON.stringify(arr(b.benefits)),
    usage: b.usage || null, ingredients: b.ingredients || null, weight: b.weight || null, badges: JSON.stringify(arr(b.badges)), personas: JSON.stringify(arr(b.personas)),
    combo_items: combo && combo.length ? JSON.stringify(combo) : null, tiktok_url: b.tiktok_url || null, shopee_url: b.shopee_url || null,
    seo_title: b.seo_title || null, seo_desc: b.seo_desc || null, commissionable: b.commissionable === false || b.commissionable === 0 ? 0 : 1,
    weight_g: num(b.weight_g) ?? 300, length_cm: num(b.length_cm) ?? 15, width_cm: num(b.width_cm) ?? 10, height_cm: num(b.height_cm) ?? 10,
    fragile: b.fragile ? 1 : 0, sort: num(b.sort) ?? 100, active: b.active === false || b.active === 0 ? 0 : 1,
  };
}

// Tạo đơn tay cho kênh TikTok Shop, Shopee, Zalo, B2B, cửa hàng
async function manualOrder(env, b, user) {
  const channel = Object.keys(CHANNEL_LABEL).includes(b.channel) ? b.channel : 'zalo';
  const phone = normPhone(b.phone);
  if (!b.name || !phone) throw new HttpError(400, 'Cần tên và số điện thoại khách');
  const products = await loadProducts(env, { all: true });
  const bySku = new Map(products.map((x) => [x.sku, x]));
  const items = (b.items || []).map((i) => ({ p: bySku.get(String(i.sku).toUpperCase()), qty: Math.max(1, Number(i.qty) || 1), price: i.price })).filter((i) => i.p);
  if (!items.length) throw new HttpError(400, 'Chưa chọn sản phẩm');
  const priceOf = (i) => (i.price != null && i.price !== '' ? Math.round(Number(i.price)) : channel === 'b2b' && i.p.wholesale_price ? i.p.wholesale_price : i.p.price);
  const subtotal = items.reduce((s, i) => s + priceOf(i) * i.qty, 0);
  const discount = Math.round(Number(b.discount) || 0);
  const ship = Math.round(Number(b.shipping_fee) || 0);
  const aff = b.affiliate_code ? await first(env, 'SELECT id FROM affiliates WHERE code=?', String(b.affiliate_code).toUpperCase()) : null;
  const custId = await upsertCustomer(env, { phone, name: b.name, address: b.address, province: b.province, source: channel, affiliate_id: aff?.id }, !!aff);
  let code;
  for (let i = 0; i < 8 && !code; i++) { const c = 'DL' + randomCode(6, '0123456789'); if (!(await first(env, 'SELECT 1 FROM orders WHERE code=?', c))) code = c; }
  const method = ['tiktok', 'shopee'].includes(channel) ? 'platform' : b.payment_method || 'cod';
  const parcel = buildParcel(items.map((i) => ({ ...i.p, qty: i.qty })), (await getSetting(env, 'shipping', {})) || {});
  const r = await run(env, `INSERT INTO orders (code, channel, external_id, customer_id, name, phone, address, province, note, subtotal, discount, shipping_fee, total, affiliate_id, ref_source,
    payment_method, payment_status, status, parcel_weight, parcel_dims, fragile, admin_note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')))`,
  code, channel, b.external_id || null, custId, b.name, phone, b.address || null, b.province || null, b.note || null, subtotal, discount, ship, Math.max(0, subtotal - discount + ship),
  aff?.id || null, aff ? 'admin' : null, method, b.paid ? 'paid' : 'unpaid', b.status && STATUS_LABEL[b.status] ? b.status : 'confirmed', parcel.weight, JSON.stringify(parcel), parcel.fragile ? 1 : 0,
  `Tạo tay bởi ${user.username}`, toSqlTime(b.created_at));
  const orderId = r.meta.last_row_id;
  await env.DB.batch(items.map((i) => stmt(env, 'INSERT INTO order_items (order_id, product_id, sku, name, price, qty, commissionable) VALUES (?,?,?,?,?,?,?)',
    orderId, i.p.id, i.p.sku, `${i.p.name} · ${i.p.subtitle || ''}`, priceOf(i), i.qty, i.p.commissionable)));
  // trừ kho
  const st = [];
  for (const i of items) {
    if (i.p.kind === 'combo' && i.p.combo_items?.length) for (const ci of i.p.combo_items) st.push(stmt(env, 'UPDATE products SET stock=MAX(0, stock-?) WHERE sku=?', ci.qty * i.qty, ci.sku));
    else st.push(stmt(env, 'UPDATE products SET stock=MAX(0, stock-?) WHERE sku=?', i.qty, i.p.sku));
  }
  await env.DB.batch(st);
  let o = await first(env, 'SELECT * FROM orders WHERE id=?', orderId);
  if (o.status === 'completed') { o.status = 'confirmed'; await run(env, "UPDATE orders SET status='confirmed' WHERE id=?", orderId); o = await setOrderStatus(env, o, 'completed', user.username); }
  else if (aff) await ensureCommissions(env, o);
  await refreshCustomerStats(env, custId);
  return o;
}

// Nhập đơn từ file CSV xuất ở TikTok Shop / Shopee (ánh xạ cột theo tên thường gặp)
async function importOrders(env, b, user) {
  const channel = b.channel === 'shopee' ? 'shopee' : 'tiktok';
  const rows = parseCsv(b.csv || '');
  if (rows.length < 2) throw new HttpError(400, 'File không có dữ liệu');
  const head = rows[0].map((h) => slugify(h));
  const find = (...names) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const col = {
    id: find('order-id', 'ma-don-hang', 'order-sn', 'ma-don'), sku: find('seller-sku', 'sku-phan-loai-hang', 'sku-san-pham', 'sku'), qty: find('quantity', 'so-luong'),
    price: find('sku-subtotal-after-discount', 'gia-uu-dai', 'unit-price', 'gia-ban'), name: find('recipient', 'ten-nguoi-nhan', 'nguoi-nhan'), phone: find('phone', 'so-dien-thoai'),
    address: find('detail-address', 'dia-chi-nhan-hang', 'dia-chi'), province: find('province', 'tinh-thanh-pho', 'tinh'), date: find('created-time', 'ngay-dat-hang', 'thoi-gian-dat'),
    status: find('order-status', 'trang-thai-don-hang', 'trang-thai'), ship: find('shipping-fee', 'phi-van-chuyen'),
  };
  if (col.id < 0 || col.sku < 0) throw new HttpError(400, 'Không tìm thấy cột Mã đơn hàng / SKU trong file');
  const groups = new Map();
  for (const r of rows.slice(1)) {
    const id = String(r[col.id] || '').trim();
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }
  let created = 0, skipped = 0; const errors = [];
  for (const [id, rs] of groups) {
    if (await first(env, 'SELECT 1 FROM orders WHERE channel=? AND external_id=?', channel, id)) { skipped++; continue; }
    const r0 = rs[0];
    const st = slugify(col.status >= 0 ? r0[col.status] : '');
    const status = /huy|cancel/.test(st) ? 'cancelled' : /hoan-thanh|completed|da-giao|delivered/.test(st) ? 'completed' : /dang-giao|shipped|in-transit/.test(st) ? 'shipping' : 'confirmed';
    if (status === 'cancelled') { skipped++; continue; }
    try {
      await manualOrder(env, {
        channel, external_id: id, name: col.name >= 0 ? r0[col.name] : `Khách ${channel}`, phone: (col.phone >= 0 && normPhone(r0[col.phone])) || '0000000000',
        address: col.address >= 0 ? r0[col.address] : null, province: col.province >= 0 ? r0[col.province] : null, status,
        shipping_fee: col.ship >= 0 ? Number(String(r0[col.ship]).replace(/[^\d]/g, '')) || 0 : 0, created_at: col.date >= 0 ? r0[col.date] : null,
        items: rs.map((r) => ({ sku: r[col.sku], qty: Number(r[col.qty]) || 1, price: col.price >= 0 ? Number(String(r[col.price]).replace(/[^\d]/g, '')) / (Number(r[col.qty]) || 1) || null : null })),
      }, user);
      created++;
    } catch (e) { errors.push(`${id}: ${e.message}`); }
  }
  return { created, skipped, errors: errors.slice(0, 20) };
}

async function dashboard(env, days) {
  const since = `-${days} days`;
  const live = "status NOT IN ('cancelled','returned')";
  const [k, prev, byDay, byChannel, top, funnel, recent, lowStock, tasks, tickets, wds, owed, newCust, repeat, pendingPay, ship] = await Promise.all([
    first(env, `SELECT COUNT(*) orders, IFNULL(SUM(total),0) revenue, IFNULL(SUM(CASE WHEN payment_status='paid' THEN total END),0) paid, IFNULL(SUM(discount),0) discount FROM orders WHERE ${live} AND created_at > datetime('now', ?)`, since),
    first(env, `SELECT COUNT(*) orders, IFNULL(SUM(total),0) revenue FROM orders WHERE ${live} AND created_at > datetime('now', ?) AND created_at <= datetime('now', ?)`, `-${days * 2} days`, since),
    all(env, `SELECT date(created_at, '+7 hours') d, channel, COUNT(*) n, SUM(total) revenue FROM orders WHERE ${live} AND created_at > datetime('now', ?) GROUP BY d, channel ORDER BY d`, since),
    all(env, `SELECT channel, COUNT(*) n, SUM(total) revenue FROM orders WHERE ${live} AND created_at > datetime('now', ?) GROUP BY channel ORDER BY revenue DESC`, since),
    all(env, `SELECT i.sku, i.name, SUM(i.qty) qty, SUM(i.qty*i.price) revenue FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.${live.replace('status', 'status')} AND o.created_at > datetime('now', ?) GROUP BY i.sku ORDER BY revenue DESC LIMIT 8`, since),
    all(env, `SELECT type, COUNT(DISTINCT sid) n FROM events WHERE ts > datetime('now', ?) AND type IN ('page_view','view_product','add_to_cart','begin_checkout','purchase') GROUP BY type`, since),
    all(env, 'SELECT o.id, o.code, o.name, o.total, o.status, o.payment_status, o.payment_method, o.channel, o.created_at FROM orders o ORDER BY o.id DESC LIMIT 8'),
    all(env, "SELECT sku, name, subtitle, stock FROM products WHERE active=1 AND kind!='combo' AND stock < 30 ORDER BY stock"),
    first(env, "SELECT COUNT(*) n FROM care_tasks WHERE status='open' AND due_at <= datetime('now','+1 day')"),
    first(env, "SELECT COUNT(*) n FROM tickets WHERE status!='resolved'"),
    first(env, "SELECT COUNT(*) n, IFNULL(SUM(amount),0) total FROM withdrawals WHERE status IN ('requested','approved')"),
    first(env, "SELECT IFNULL(SUM(CASE WHEN status='pending' THEN amount END),0) pending, IFNULL(SUM(CASE WHEN status='available' THEN amount END),0) available FROM commissions"),
    first(env, 'SELECT COUNT(*) n FROM customers WHERE first_order_at > datetime(\'now\', ?)', since),
    first(env, 'SELECT SUM(CASE WHEN orders_count>=2 THEN 1 ELSE 0 END) r, SUM(CASE WHEN orders_count>=1 THEN 1 ELSE 0 END) t FROM customers'),
    first(env, "SELECT COUNT(*) n FROM orders WHERE status='new'"),
    first(env, "SELECT COUNT(*) n FROM orders WHERE status='confirmed'"),
  ]);
  const paidOut = await first(env, "SELECT IFNULL(SUM(amount),0) s FROM withdrawals WHERE status='paid'");
  const f = Object.fromEntries(funnel.map((x) => [x.type, x.n]));
  return {
    days, kpi: { ...k, aov: k.orders ? Math.round(k.revenue / k.orders) : 0, prev_revenue: prev.revenue, prev_orders: prev.orders, sessions: f.page_view || 0,
      conversion: f.page_view ? +(100 * (f.purchase || 0) / f.page_view).toFixed(2) : 0, new_customers: newCust.n, repeat_rate: repeat.t ? Math.round((100 * repeat.r) / repeat.t) : 0 },
    by_day: byDay, by_channel: byChannel.map((c) => ({ ...c, label: CHANNEL_LABEL[c.channel] || c.channel })), top_products: top,
    funnel: [['Xem trang', f.page_view || 0], ['Xem sản phẩm', f.view_product || 0], ['Thêm giỏ', f.add_to_cart || 0], ['Bắt đầu thanh toán', f.begin_checkout || 0], ['Đặt hàng', f.purchase || 0]],
    recent, low_stock: lowStock,
    todo: { new_orders: pendingPay.n, to_ship: ship.n, tasks_due: tasks.n, open_tickets: tickets.n, withdrawals: wds.n, withdrawals_total: wds.total },
    commissions: { pending: owed.pending, payable: Math.max(0, owed.available - paidOut.s - wds.total) },
  };
}

async function analytics(env, days) {
  const since = `-${days} days`;
  const [daily, sources, pages, products, devices, refs, qr, utm] = await Promise.all([
    all(env, "SELECT date(ts,'+7 hours') d, COUNT(DISTINCT sid) sessions, SUM(CASE WHEN type='page_view' THEN 1 ELSE 0 END) views FROM events WHERE ts > datetime('now', ?) GROUP BY d ORDER BY d", since),
    all(env, `SELECT IFNULL(source,'(trực tiếp)') source, IFNULL(medium,'') medium, COUNT(DISTINCT sid) sessions,
      COUNT(DISTINCT CASE WHEN type='purchase' THEN sid END) orders, IFNULL(SUM(CASE WHEN type='purchase' THEN value END),0) revenue
      FROM events WHERE ts > datetime('now', ?) GROUP BY source, medium ORDER BY sessions DESC LIMIT 20`, since),
    all(env, "SELECT path, COUNT(*) views, COUNT(DISTINCT sid) visitors FROM events WHERE type='page_view' AND ts > datetime('now', ?) GROUP BY path ORDER BY views DESC LIMIT 15", since),
    all(env, `SELECT p.name, p.subtitle, p.sku, SUM(CASE WHEN e.type='view_product' THEN 1 ELSE 0 END) views, SUM(CASE WHEN e.type='add_to_cart' THEN 1 ELSE 0 END) carts
      FROM events e JOIN products p ON p.id=e.product_id WHERE e.ts > datetime('now', ?) GROUP BY p.id ORDER BY views DESC`, since),
    all(env, "SELECT IFNULL(device,'?') device, COUNT(DISTINCT sid) n FROM events WHERE ts > datetime('now', ?) GROUP BY device", since),
    all(env, `SELECT e.ref, a.name, COUNT(DISTINCT e.sid) visitors, COUNT(DISTINCT CASE WHEN e.type='purchase' THEN e.sid END) orders FROM events e LEFT JOIN affiliates a ON a.code=e.ref
      WHERE e.ref IS NOT NULL AND e.ts > datetime('now', ?) GROUP BY e.ref ORDER BY visitors DESC LIMIT 15`, since),
    all(env, 'SELECT l.code, p.name, p.subtitle, l.scans FROM lots l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.scans DESC LIMIT 10'),
    all(env, "SELECT IFNULL(utm_campaign,'(không có)') campaign, COUNT(*) orders, SUM(total) revenue FROM orders WHERE status NOT IN ('cancelled','returned') AND created_at > datetime('now', ?) AND utm_campaign IS NOT NULL GROUP BY utm_campaign ORDER BY revenue DESC", since),
  ]);
  const qrOrders = await first(env, "SELECT COUNT(*) n FROM orders WHERE status NOT IN ('cancelled','returned') AND created_at > datetime('now', ?)", since);
  const qrScans = await first(env, "SELECT COUNT(*) n FROM events WHERE type='qr_scan' AND ts > datetime('now', ?)", since);
  return { days, daily, sources, pages, products, devices, refs, qr, utm, qr_rate: qrOrders.n ? Math.round((100 * qrScans.n) / qrOrders.n) : 0, qr_scans: qrScans.n };
}

async function seoAudit(env, url) {
  const s = await getSettings(env);
  const products = await loadProducts(env, { all: true });
  const posts = await all(env, 'SELECT * FROM posts');
  const check = (title, desc, extra = []) => {
    const issues = [];
    const tl = (title || '').length, dl = (desc || '').length;
    if (!title) issues.push('Thiếu tiêu đề SEO'); else if (tl < 30 || tl > 65) issues.push(`Tiêu đề ${tl} ký tự (nên 30–65)`);
    if (!desc) issues.push('Thiếu mô tả SEO'); else if (dl < 70 || dl > 165) issues.push(`Mô tả ${dl} ký tự (nên 70–165)`);
    return [...issues, ...extra];
  };
  const items = [
    ...products.filter((p) => p.active).map((p) => ({ type: 'Sản phẩm', id: p.id, name: `${p.name} · ${p.subtitle || ''}`, url: `/san-pham/${p.slug}`, title: p.seo_title, desc: p.seo_desc,
      issues: check(p.seo_title, p.seo_desc, [!p.image && 'Thiếu ảnh', (p.story || '').length < 150 && 'Nội dung câu chuyện ngắn (<150 ký tự)', !p.tiktok_url && !p.shopee_url && 'Chưa gắn link TikTok/Shopee'].filter(Boolean)) })),
    ...posts.filter((p) => p.published).map((p) => ({ type: 'Bài viết', id: p.id, name: p.title, url: `/blog/${p.slug}`, title: p.seo_title || p.title, desc: p.seo_desc || p.excerpt,
      issues: check(p.seo_title || p.title, p.seo_desc || p.excerpt, [(p.body || '').length < 600 && 'Bài viết ngắn (<600 ký tự)', !p.cover && 'Thiếu ảnh bìa'].filter(Boolean)) })),
  ];
  const global = [
    { ok: !!s.seo?.title && s.seo.title.length <= 70, text: 'Tiêu đề trang chủ' },
    { ok: !!s.seo?.description, text: 'Mô tả trang chủ' },
    { ok: !!s.seo?.og_image, text: 'Ảnh chia sẻ mạng xã hội (OG image)' },
    { ok: !!s.seo?.ga4, text: 'Google Analytics 4' },
    { ok: !!s.seo?.gsc_verify, text: 'Xác minh Google Search Console' },
    { ok: !!s.seo?.fb_pixel, text: 'Meta (Facebook) Pixel' },
    { ok: !!s.seo?.tiktok_pixel, text: 'TikTok Pixel' },
    { ok: true, text: `Sitemap tự động: ${url.origin}/sitemap.xml` },
    { ok: true, text: 'Dữ liệu cấu trúc Product, Organization, Breadcrumb (JSON-LD)' },
  ];
  const score = Math.round(100 * (items.filter((i) => !i.issues.length).length + global.filter((g) => g.ok).length) / (items.length + global.length));
  return { score, global, items };
}
