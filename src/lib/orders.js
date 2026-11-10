// Vòng đời đơn hàng: tạo đơn, thanh toán, giao hàng, hoa hồng 3 tầng, chăm sóc sau bán
import { all, first, run, stmt, getSettings } from './db.js';
import { HttpError, normPhone, validPhone, nowSql, addDays, randomCode } from './util.js';
import { priceCart, loadProducts } from './catalog.js';
import { buildCommissions, commissionBase, tierFor } from './commission.js';
import { createPaymentRequest, getPaymentRequest, thuchiConfig, manualQr } from './payment.js';

export const STATUS_LABEL = { new: 'Mới', confirmed: 'Đã xác nhận', shipping: 'Đang giao', completed: 'Hoàn tất', cancelled: 'Đã huỷ', returned: 'Hoàn hàng' };
export const PAY_LABEL = { unpaid: 'Chưa thanh toán', partial: 'Thanh toán thiếu', paid: 'Đã thanh toán', refunded: 'Đã hoàn tiền' };
export const CHANNEL_LABEL = { web: 'Website', ctv: 'Cộng tác viên', tiktok: 'TikTok Shop', shopee: 'Shopee', zalo: 'Zalo/Facebook', b2b: 'B2B/Quán', pos: 'Cửa hàng' };

async function newOrderCode(env) {
  for (let i = 0; i < 8; i++) {
    const c = 'DL' + randomCode(6, '0123456789');
    if (!(await first(env, 'SELECT 1 FROM orders WHERE code=?', c))) return c;
  }
  throw new HttpError(500, 'Không tạo được mã đơn, thử lại');
}

export async function upsertCustomer(env, { phone, name, email, address, province, source, affiliate_id, persona }, bind = true) {
  const p = normPhone(phone);
  const c = await first(env, 'SELECT * FROM customers WHERE phone=?', p);
  if (c) {
    await run(env, `UPDATE customers SET name=COALESCE(?, name), email=COALESCE(?, email), address=COALESCE(?, address), province=COALESCE(?, province),
      persona=COALESCE(persona, ?), affiliate_id=CASE WHEN affiliate_id IS NULL AND ? THEN ? ELSE affiliate_id END WHERE id=?`,
    name || null, email || null, address || null, province || null, persona || null, bind ? 1 : 0, affiliate_id || null, c.id);
    return c.id;
  }
  const r = await run(env, 'INSERT INTO customers (phone, name, email, address, province, source, affiliate_id, persona) VALUES (?,?,?,?,?,?,?,?)',
    p, name || null, email || null, address || null, province || null, source || 'web', bind ? affiliate_id || null : null, persona || null);
  return r.meta.last_row_id;
}

export async function refreshCustomerStats(env, customerId) {
  if (!customerId) return;
  await run(env, `UPDATE customers SET
    orders_count=(SELECT COUNT(*) FROM orders WHERE customer_id=?1 AND status NOT IN ('cancelled','returned')),
    total_spent=(SELECT IFNULL(SUM(total),0) FROM orders WHERE customer_id=?1 AND status NOT IN ('cancelled','returned')),
    first_order_at=(SELECT MIN(created_at) FROM orders WHERE customer_id=?1 AND status NOT IN ('cancelled','returned')),
    last_order_at=(SELECT MAX(created_at) FROM orders WHERE customer_id=?1 AND status NOT IN ('cancelled','returned'))
    WHERE id=?1`, customerId);
}

// Trừ / hoàn tồn kho (combo trừ vào từng thành phần), Flash Sale, lượt dùng voucher
async function applyInventory(env, order, sign) {
  const items = await all(env, 'SELECT * FROM order_items WHERE order_id=?', order.id);
  const products = await loadProducts(env, { all: true });
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const stmts = [];
  for (const it of items) {
    const p = bySku.get(it.sku);
    if (p && p.kind === 'combo' && Array.isArray(p.combo_items) && p.combo_items.length) {
      for (const ci of p.combo_items) stmts.push(stmt(env, 'UPDATE products SET stock=MAX(0, stock - ?) WHERE sku=?', sign * ci.qty * it.qty, ci.sku));
    } else if (p) {
      stmts.push(stmt(env, 'UPDATE products SET stock=MAX(0, stock - ?) WHERE sku=?', sign * it.qty, it.sku));
    }
    if (it.flash_item_id) stmts.push(stmt(env, 'UPDATE flash_sale_items SET sold=MAX(0, sold + ?) WHERE id=?', sign * it.qty, it.flash_item_id));
  }
  if (order.voucher_code) stmts.push(stmt(env, 'UPDATE vouchers SET used=MAX(0, used + ?) WHERE code=?', sign, order.voucher_code));
  if (stmts.length) await env.DB.batch(stmts);
}

/** Đặt hàng từ website */
export async function checkout(env, b, meta = {}) {
  const name = String(b.name || '').trim();
  const phone = normPhone(b.phone);
  const address = String(b.address || '').trim();
  if (name.length < 2) throw new HttpError(400, 'Vui lòng nhập họ tên người nhận');
  if (!validPhone(phone)) throw new HttpError(400, 'Số điện thoại chưa đúng (10 số, bắt đầu bằng 0)');
  if (address.length < 5) throw new HttpError(400, 'Vui lòng nhập địa chỉ nhận hàng');
  const to = b.to || {};
  if (!to.province && !to.city) throw new HttpError(400, 'Vui lòng chọn tỉnh/thành phố');
  const settings = await getSettings(env);
  const pay = settings.payment || {};
  const method = b.payment_method === 'cod' ? 'cod' : 'sepay';
  if (method === 'cod' && pay.cod_enabled === false) throw new HttpError(400, 'Hiện chưa nhận thanh toán khi nhận hàng');
  if (method === 'sepay' && pay.online_enabled === false) throw new HttpError(400, 'Thanh toán online đang tạm dừng, vui lòng chọn COD');

  const q = await priceCart(env, { ...b, phone, payment_method: method });
  if (!q.lines.length) throw new HttpError(400, q.errors[0] || 'Giỏ hàng trống');
  const blocking = q.errors.filter((e) => !/đã giảm số lượng/.test(e));
  if (blocking.length) throw new HttpError(409, blocking.join('. '), { quote: q });
  if (method === 'cod' && pay.cod_max && q.total > pay.cod_max) throw new HttpError(400, `Đơn trên ${pay.cod_max.toLocaleString('vi-VN')}đ vui lòng thanh toán online`);

  const aff = q.affiliate;
  const customerId = await upsertCustomer(env, { phone, name, email: b.email, address, province: to.province || to.city_name, source: aff ? 'ctv' : (meta.utm_source || 'web'), affiliate_id: aff?.id, persona: b.persona },
    settings.affiliate?.lifetime_binding !== false);
  const code = await newOrderCode(env);
  const sel = q.shipping.selected;
  const r = await run(env, `INSERT INTO orders (code, channel, customer_id, name, phone, email, address, province, city_code, district_code, ward_code, district, ward, note,
      subtotal, discount, shipping_fee, total, voucher_code, affiliate_id, ref_source, payment_method, shipping_carrier, shipping_service, shipping_rate_id, shipping_expected,
      shipping_cost, shop_pays_ship, parcel_weight, parcel_dims, fragile, utm_source, utm_medium, utm_campaign, session_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  code, aff ? 'ctv' : 'web', customerId, name, phone, b.email || null, address, to.province || to.city_name || null, to.city || null, to.district || null, to.ward || null,
  to.district_name || null, to.ward_name || null, String(b.note || '').slice(0, 500) || null,
  q.subtotal, q.discount, q.shipping.fee, q.total, q.voucher, aff?.id || null, q.ref_source, method,
  sel?.carrier || null, sel?.service || null, sel?.id || null, sel?.expected || null, q.shipping.carrier_fee || null, q.shipping.shop_pays ? 1 : 0,
  q.parcel.weight, JSON.stringify(q.parcel), q.parcel.fragile ? 1 : 0,
  meta.utm_source || null, meta.utm_medium || null, meta.utm_campaign || null, meta.sid || null);
  const orderId = r.meta.last_row_id;
  await env.DB.batch(q.lines.map((l) => stmt(env, 'INSERT INTO order_items (order_id, product_id, sku, name, price, qty, flash_item_id, commissionable) VALUES (?,?,?,?,?,?,?,?)',
    orderId, l.product_id, l.sku, `${l.name} · ${l.subtitle || ''}`.replace(/ · $/, ''), l.price, l.qty, l.flash_item_id, l.commissionable)));
  let order = await first(env, 'SELECT * FROM orders WHERE id=?', orderId);
  await applyInventory(env, order, +1);
  await refreshCustomerStats(env, customerId);

  if (method === 'sepay') {
    const tc = await thuchiConfig(env);
    if (tc.enabled) {
      try {
        const pr = await createPaymentRequest(env, order);
        await run(env, 'UPDATE orders SET payment_code=?, payment_qr=?, payment_account=?, payment_bank=? WHERE id=?', pr.code, pr.qr_image_url, pr.account_number, pr.bank, orderId);
      } catch (e) {
        console.error('thuchi', e.message);
        await fallbackPayment(env, order, pay);
      }
    } else await fallbackPayment(env, order, pay);
  } else if (aff) {
    await ensureCommissions(env, order); // COD: hoa hồng tạm tính ngay khi đặt
  }
  order = await first(env, 'SELECT * FROM orders WHERE id=?', orderId);
  await run(env, 'INSERT INTO events (sid, type, path, value, source, medium, campaign, ref) VALUES (?,?,?,?,?,?,?,?)',
    meta.sid || null, 'purchase', '/thanh-toan', order.total, meta.utm_source || null, meta.utm_medium || null, meta.utm_campaign || null, aff?.code || null);
  return { order, quote: q };
}

async function fallbackPayment(env, order, pay) {
  const qr = manualQr(pay.bank, order);
  await run(env, 'UPDATE orders SET payment_code=?, payment_qr=?, payment_account=?, payment_bank=? WHERE id=?', order.code, qr, pay.bank?.account || null, pay.bank?.bank || null, order.id);
}

// Đồng bộ trạng thái thanh toán từ web thu chi
export async function syncPayment(env, order) {
  if (order.payment_method !== 'sepay' || order.payment_status === 'paid' || !order.payment_code || order.payment_code === order.code) return order;
  const tc = await thuchiConfig(env);
  if (!tc.enabled) return order;
  try {
    const pr = await getPaymentRequest(env, order.payment_code);
    if (pr.status === 'paid' || pr.paid_amount >= order.total) return markPaid(env, order, pr.paid_amount, 'sepay');
    if (pr.paid_amount > 0 && pr.paid_amount !== order.paid_amount) {
      await run(env, "UPDATE orders SET paid_amount=?, payment_status='partial', updated_at=datetime('now') WHERE id=?", pr.paid_amount, order.id);
      return first(env, 'SELECT * FROM orders WHERE id=?', order.id);
    }
  } catch (e) { console.error('syncPayment', order.code, e.message); }
  return order;
}

export async function markPaid(env, order, amount, by = 'admin') {
  if (order.payment_status === 'paid') return order;
  await run(env, `UPDATE orders SET payment_status='paid', paid_amount=?, paid_at=datetime('now'),
    status=CASE WHEN status='new' THEN 'confirmed' ELSE status END, updated_at=datetime('now'),
    admin_note=TRIM(IFNULL(admin_note,'') || ' ' || ?) WHERE id=?`, amount ?? order.total, `[${nowSql()}] Đã thanh toán (${by}).`, order.id);
  const o = await first(env, 'SELECT * FROM orders WHERE id=?', order.id);
  await ensureCommissions(env, o);
  return o;
}

// Doanh số cá nhân CTV trong tháng (theo doanh số tính hoa hồng trực tiếp)
async function monthlySales(env, affId, monthOffset = 0) {
  const r = await first(env, `SELECT IFNULL(SUM(base),0) s FROM commissions WHERE affiliate_id=? AND level=0 AND status!='void'
    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', ?)`, affId, `${monthOffset} months`);
  return r.s;
}

export async function recomputeTier(env, affId) {
  const a = await first(env, 'SELECT id, tier, tier_locked FROM affiliates WHERE id=?', affId);
  if (!a || a.tier_locked) return;
  const tiers = (await getSettings(env)).affiliate?.tiers || [];
  if (!tiers.length) return;
  const sales = Math.max(await monthlySales(env, affId, 0), await monthlySales(env, affId, -1));
  const t = tierFor(sales, tiers);
  if (t && Number(t.id) !== Number(a.tier)) await run(env, 'UPDATE affiliates SET tier=? WHERE id=?', t.id, affId);
}

// Tạo hoa hồng (pending) cho đơn có người giới thiệu: trực tiếp + 2 tầng gián tiếp
export async function ensureCommissions(env, order) {
  if (!order.affiliate_id || ['cancelled', 'returned'].includes(order.status)) return;
  const exist = await first(env, 'SELECT COUNT(*) n FROM commissions WHERE order_id=?', order.id);
  if (exist.n > 0) return;
  const settings = await getSettings(env);
  const tiers = settings.affiliate?.tiers || [];
  const items = await all(env, 'SELECT price, qty, commissionable FROM order_items WHERE order_id=?', order.id);
  const base = commissionBase(items, order.subtotal, order.discount);
  const chain = [];
  let cur = await first(env, 'SELECT id, tier, status, parent_id FROM affiliates WHERE id=?', order.affiliate_id);
  for (let i = 0; i < 3 && cur; i++) {
    chain.push(cur);
    cur = cur.parent_id ? await first(env, 'SELECT id, tier, status, parent_id FROM affiliates WHERE id=?', cur.parent_id) : null;
    if (cur && chain.some((c) => c.id === cur.id)) break; // chống vòng lặp
  }
  const rows = buildCommissions(base, chain, tiers);
  if (!rows.length) return;
  await env.DB.batch(rows.map((c) => stmt(env, 'INSERT OR IGNORE INTO commissions (affiliate_id, order_id, level, tier, base, rate, amount, status) VALUES (?,?,?,?,?,?,?,?)',
    c.affiliate_id, order.id, c.level, c.tier, c.base, c.rate, c.amount, 'pending')));
  await recomputeTier(env, order.affiliate_id);
}

/** Đổi trạng thái đơn (quản trị, webhook Goship) */
export async function setOrderStatus(env, order, status, by = 'admin') {
  if (!STATUS_LABEL[status]) throw new HttpError(400, 'Trạng thái không hợp lệ');
  if (order.status === status) return order;
  const wasClosed = ['cancelled', 'returned'].includes(order.status);
  const closing = ['cancelled', 'returned'].includes(status);
  const settings = await getSettings(env);
  const hold = Number(settings.affiliate?.hold_days ?? 7);
  await run(env, `UPDATE orders SET status=?, updated_at=datetime('now'), admin_note=TRIM(IFNULL(admin_note,'') || ' ' || ?) WHERE id=?`,
    status, `[${nowSql()}] ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[status]} (${by}).`, order.id);
  if (closing && !wasClosed) {
    await applyInventory(env, order, -1);
    await run(env, "UPDATE commissions SET status='void' WHERE order_id=? AND status!='void'", order.id);
    await run(env, "UPDATE care_tasks SET status='skipped' WHERE order_id=? AND status='open'", order.id);
  } else if (!closing && wasClosed) {
    await applyInventory(env, order, +1);
    await run(env, "UPDATE commissions SET status='pending', available_at=NULL WHERE order_id=? AND status='void'", order.id);
  }
  if (status === 'completed') {
    await run(env, `UPDATE orders SET completed_at=datetime('now'),
      payment_status=CASE WHEN payment_method IN ('cod','platform') THEN 'paid' ELSE payment_status END,
      paid_amount=CASE WHEN payment_method IN ('cod','platform') THEN total ELSE paid_amount END,
      paid_at=CASE WHEN payment_method IN ('cod','platform') AND paid_at IS NULL THEN datetime('now') ELSE paid_at END WHERE id=?`, order.id);
    const o = await first(env, 'SELECT * FROM orders WHERE id=?', order.id);
    await ensureCommissions(env, o);
    await run(env, "UPDATE commissions SET available_at=datetime('now', ?) WHERE order_id=? AND status='pending'", `+${hold} days`, order.id);
    await createCareTasks(env, o);
  }
  if (['confirmed', 'shipping'].includes(status)) {
    const o = await first(env, 'SELECT * FROM orders WHERE id=?', order.id);
    if (o.payment_method !== 'sepay' || o.payment_status === 'paid') await ensureCommissions(env, o);
  }
  if (order.affiliate_id) await recomputeTier(env, order.affiliate_id);
  await refreshCustomerStats(env, order.customer_id);
  return first(env, 'SELECT * FROM orders WHERE id=?', order.id);
}

// Chăm sóc sau bán: hỏi thăm sau 3 ngày, nhắc mua lại theo chu kỳ dùng hết sản phẩm
export async function createCareTasks(env, order) {
  if (!order.customer_id) return;
  const items = await all(env, 'SELECT sku, qty FROM order_items WHERE order_id=?', order.id);
  const cycle = items.some((i) => i.sku === 'BCX-350' || i.sku === 'COMBO-KHOE') ? 25 : items.some((i) => i.sku.startsWith('COT-1L')) ? 14 : 35;
  const now = new Date();
  await env.DB.batch([
    stmt(env, 'INSERT OR IGNORE INTO care_tasks (customer_id, order_id, type, title, due_at) VALUES (?,?,?,?,?)', order.customer_id, order.id, 'followup',
      `Hỏi thăm trải nghiệm đơn ${order.code}, xin đánh giá 5 sao và hướng dẫn quét QR`, nowSql(addDays(now, 3))),
    stmt(env, 'INSERT OR IGNORE INTO care_tasks (customer_id, order_id, type, title, due_at) VALUES (?,?,?,?,?)', order.customer_id, order.id, 'repurchase',
      `Nhắc mua lại (đơn ${order.code} sắp dùng hết), gợi ý combo hoặc gói định kỳ`, nowSql(addDays(now, cycle))),
  ]);
}

/** Việc định kỳ (cron 5 phút) */
export async function cronTick(env) {
  const out = { synced: 0, released: 0, expired: 0 };
  // 1. hỏi trạng thái thanh toán các đơn online chưa trả trong 48 giờ
  const pending = await all(env, "SELECT * FROM orders WHERE payment_method='sepay' AND payment_status IN ('unpaid','partial') AND status IN ('new','confirmed') AND created_at > datetime('now','-2 days') ORDER BY id DESC LIMIT 40");
  for (const o of pending) {
    const n = await syncPayment(env, o);
    if (n.payment_status === 'paid') out.synced++;
  }
  // 2. huỷ đơn online quá hạn chưa thanh toán, hoàn kho và suất Flash Sale
  const s = await getSettings(env);
  const mins = Number(s.payment?.expire_minutes || 1440);
  const stale = await all(env, "SELECT * FROM orders WHERE payment_method='sepay' AND payment_status='unpaid' AND status='new' AND created_at < datetime('now', ?)", `-${mins} minutes`);
  for (const o of stale) { await setOrderStatus(env, o, 'cancelled', 'tự động: quá hạn thanh toán'); out.expired++; }
  // 3. hoa hồng hết thời gian giữ (đổi trả) → khả dụng trong ví
  const r = await run(env, `UPDATE commissions SET status='available' WHERE status='pending' AND available_at IS NOT NULL AND available_at <= datetime('now')
    AND order_id IN (SELECT id FROM orders WHERE status='completed')`);
  out.released = r.meta.changes || 0;
  // 4. dọn phiên hết hạn, giữ sự kiện analytics 400 ngày
  await run(env, "DELETE FROM sessions WHERE expires_at < datetime('now')");
  await run(env, "DELETE FROM events WHERE ts < datetime('now','-400 days')");
  return out;
}
