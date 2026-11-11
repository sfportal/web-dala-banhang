// Danh mục sản phẩm, Flash Sale, combo, tính giá giỏ hàng
import { all, first, getSettings } from './db.js';
import { HttpError, normPhone, parseJson } from './util.js';
import { buildParcel, quoteShipping } from './shipping.js';
import { estimateEta } from './eta.js';
import { loyaltyConfig, redeemPlan, earnFor } from './loyalty.js';

const JSON_FIELDS = { benefits: [], badges: [], personas: [], combo_items: null };

export function parseProduct(p) {
  const o = { ...p };
  for (const [k, d] of Object.entries(JSON_FIELDS)) o[k] = parseJson(p[k], d);
  return o;
}

export async function loadProducts(env, { all: includeInactive = false } = {}) {
  const rows = await all(env, `SELECT * FROM products ${includeInactive ? '' : 'WHERE active=1'} ORDER BY sort, id`);
  return rows.map(parseProduct);
}

export async function activeFlash(env) {
  const sale = await first(env, "SELECT * FROM flash_sales WHERE active=1 AND starts_at<=datetime('now') AND ends_at>datetime('now') ORDER BY ends_at LIMIT 1");
  if (!sale) {
    const next = await first(env, "SELECT * FROM flash_sales WHERE active=1 AND starts_at>datetime('now') ORDER BY starts_at LIMIT 1");
    return { sale: null, next, items: new Map() };
  }
  const items = await all(env, 'SELECT * FROM flash_sale_items WHERE sale_id=?', sale.id);
  return { sale, items: new Map(items.map((i) => [i.product_id, i])) };
}

// Gắn giá hiệu lực, Flash Sale, tồn kho ảo cho combo
export function decorate(products, flash) {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  return products.map((p) => {
    const o = { ...p };
    if (p.kind === 'combo' && Array.isArray(p.combo_items) && p.combo_items.length) {
      o.stock = Math.min(...p.combo_items.map((ci) => {
        const c = bySku.get(ci.sku);
        return c ? Math.floor(c.stock / Math.max(1, ci.qty)) : 0;
      }));
      o.components = p.combo_items.map((ci) => ({ ...ci, name: bySku.get(ci.sku)?.name, subtitle: bySku.get(ci.sku)?.subtitle, image: bySku.get(ci.sku)?.image, price: bySku.get(ci.sku)?.price }));
    }
    const f = flash?.items?.get(p.id);
    o.flash = null;
    if (f && flash.sale) {
      const left = f.quota > 0 ? Math.max(0, f.quota - f.sold) : null;
      if (left === null || left > 0) {
        o.flash = { item_id: f.id, price: f.sale_price, quota: f.quota, sold: f.sold, left, per_order: f.per_order, ends_at: flash.sale.ends_at };
      }
    }
    o.effective_price = o.flash ? o.flash.price : p.price;
    const ref = o.flash ? p.price : p.compare_price;
    o.ref_price = ref && ref > o.effective_price ? ref : null;
    o.save_pct = o.ref_price ? Math.round((1 - o.effective_price / o.ref_price) * 100) : 0;
    return o;
  });
}

export function publicProduct(p) {
  const { cost, wholesale_price, ...rest } = p;
  return rest;
}

export async function loadCatalog(env) {
  const [products, flash] = await Promise.all([loadProducts(env), activeFlash(env)]);
  const list = decorate(products, flash);
  return {
    products: list.map(publicProduct),
    flash: flash.sale ? { id: flash.sale.id, name: flash.sale.name, ends_at: flash.sale.ends_at, starts_at: flash.sale.starts_at } : null,
    next_flash: flash.next ? { name: flash.next.name, starts_at: flash.next.starts_at } : null,
  };
}

/**
 * Tính giá giỏ hàng phía server (không tin giá từ trình duyệt).
 * input: { items:[{sku, qty}], voucher, ref, phone, to:{city,district,ward,province}, payment_method, rate_id }
 */
export async function priceCart(env, input, { withShipping = true } = {}) {
  const settings = await getSettings(env);
  const [products, flash] = await Promise.all([loadProducts(env), activeFlash(env)]);
  const list = decorate(products, flash);
  const bySku = new Map(list.map((p) => [p.sku, p]));
  const errors = [];
  const lines = [];
  const qtyBySku = new Map();
  for (const it of input.items || []) {
    const sku = String(it.sku || '');
    const qty = Math.min(99, Math.max(0, Math.floor(Number(it.qty) || 0)));
    if (!qty) continue;
    qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + qty);
  }
  for (const [sku, qty0] of qtyBySku) {
    const p = bySku.get(sku);
    if (!p) { errors.push(`Sản phẩm ${sku} không còn bán`); continue; }
    let qty = qty0;
    if (p.stock < qty) {
      if (p.stock <= 0) { errors.push(`${p.name} (${p.subtitle}) đã hết hàng`); continue; }
      errors.push(`${p.name} chỉ còn ${p.stock}, đã giảm số lượng`);
      qty = p.stock;
    }
    const base = { product_id: p.id, sku: p.sku, name: p.name, subtitle: p.subtitle, image: p.image, kind: p.kind, commissionable: p.commissionable,
      weight_g: p.weight_g, length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm, fragile: p.fragile, list_price: p.price };
    if (p.flash) {
      const cap = Math.min(p.flash.per_order || qty, p.flash.left ?? qty, qty);
      if (cap > 0) lines.push({ ...base, price: p.flash.price, qty: cap, flash_item_id: p.flash.item_id, flash: true });
      if (qty - cap > 0) lines.push({ ...base, price: p.price, qty: qty - cap, flash_item_id: null, flash: false });
    } else {
      lines.push({ ...base, price: p.price, qty, flash_item_id: null, flash: false });
    }
  }
  // Khoai lang sấy dẻo: chỉ bán kèm (theo kế hoạch: hàng phổ thông, sát giá vốn)
  if (lines.length && lines.every((l) => l.kind === 'addon')) {
    errors.push('Khoai lang sấy dẻo chỉ bán kèm: thêm một sản phẩm khác hoặc chọn combo');
    lines.length = 0;
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  // ---- mã giảm giá / mã cộng tác viên
  let discount = 0, discountLabel = null, freeship = false, voucher = null, affiliate = null, refSource = null;
  const code = String(input.voucher || '').trim().toUpperCase();
  const aff = settings.affiliate || {};
  if (code) {
    const v = await first(env, 'SELECT * FROM vouchers WHERE code=? AND active=1', code);
    if (v) {
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      let bad = null;
      if (v.starts_at && v.starts_at > now) bad = 'Mã chưa đến thời gian áp dụng';
      else if (v.ends_at && v.ends_at < now) bad = 'Mã đã hết hạn';
      else if (v.usage_limit && v.used >= v.usage_limit) bad = 'Mã đã hết lượt dùng';
      else if (subtotal < v.min_order) bad = `Đơn tối thiểu ${v.min_order.toLocaleString('vi-VN')}đ để dùng mã ${code}`;
      else if (v.first_order_only && input.phone) {
        const c = await first(env, "SELECT 1 FROM orders WHERE phone=? AND status NOT IN ('cancelled') LIMIT 1", normPhone(input.phone));
        if (c) bad = 'Mã chỉ dành cho đơn hàng đầu tiên';
      }
      if (bad) errors.push(bad);
      else {
        voucher = v;
        if (v.type === 'pct') discount = Math.round((subtotal * v.value) / 100);
        else if (v.type === 'fixed') discount = v.value;
        else if (v.type === 'freeship') freeship = true;
        if (v.max_discount) discount = Math.min(discount, v.max_discount);
        discountLabel = v.note || `Mã ${code}`;
      }
    } else {
      const a = await first(env, "SELECT id, code, name, tier, status, parent_id FROM affiliates WHERE code=? AND status='active'", code);
      if (a) {
        affiliate = a; refSource = 'code';
        const pct = Number(aff.buyer_discount_pct || 0);
        if (pct > 0) { discount = Math.round((subtotal * pct) / 100); discountLabel = `Mã giới thiệu ${a.code} −${pct}%`; }
      } else errors.push(`Mã ${code} không hợp lệ`);
    }
  }
  discount = Math.min(discount, subtotal);

  // ---- người giới thiệu: mã > link (cookie) > khách đã gắn với CTV
  if (!affiliate && input.ref) {
    const a = await first(env, "SELECT id, code, name, tier, status, parent_id FROM affiliates WHERE code=? AND status='active'", String(input.ref).toUpperCase());
    if (a) { affiliate = a; refSource = 'link'; }
  }
  if (!affiliate && input.phone && aff.lifetime_binding !== false) {
    const c = await first(env, "SELECT a.id, a.code, a.name, a.tier, a.status, a.parent_id FROM customers c JOIN affiliates a ON a.id=c.affiliate_id WHERE c.phone=? AND a.status='active'", normPhone(input.phone));
    if (c) { affiliate = c; refSource = 'bound'; }
  }

  // ---- CTV tự mua (SĐT người mua trùng SĐT của CTV được ghi nhận)
  //   commission (mặc định): vẫn tính hoa hồng trực tiếp, không cộng giảm giá mã CTV
  //   none: không hoa hồng cho chính CTV, người giới thiệu của họ nhận như đơn khách thường
  //   legacy: giữ cách cũ (giảm giá mã + hoa hồng)
  let selfPurchase = false;
  const selfMode = aff.self_purchase || 'commission';
  if (affiliate && input.phone && selfMode !== 'legacy') {
    const ap = await first(env, 'SELECT phone FROM affiliates WHERE id=?', affiliate.id);
    if (ap && ap.phone === normPhone(input.phone)) {
      selfPurchase = true;
      if (refSource === 'code' && !voucher) { discount = 0; discountLabel = null; }
      if (selfMode === 'none') {
        const up = affiliate.parent_id ? await first(env, "SELECT id, code, name, tier, status, parent_id FROM affiliates WHERE id=? AND status='active'", affiliate.parent_id) : null;
        affiliate = up || null; refSource = up ? 'upline' : null;
      }
    }
  }

  // ---- điểm tích luỹ (chỉ khi đã đăng nhập: points_customer_id do máy chủ gắn từ phiên, không lấy từ trình duyệt)
  const loyalty = await loyaltyConfig(env);
  let points = null, pointsDiscount = 0;
  if (input.points_customer_id && loyalty.enabled) {
    const c = await first(env, 'SELECT points FROM customers WHERE id=?', input.points_customer_id);
    const plan = redeemPlan(loyalty, c?.points || 0, subtotal - discount, input.use_points);
    pointsDiscount = plan.amount;
    points = { balance: c?.points || 0, max: plan.max, used: plan.use, discount: plan.amount, point_value: loyalty.point_value, min_redeem: loyalty.min_redeem };
  }

  // ---- giao hàng
  const ship = settings.shipping || {};
  const parcel = buildParcel(lines, ship);
  const after = subtotal - discount - pointsDiscount;
  const freeByThreshold = ship.free_threshold > 0 && after + pointsDiscount >= ship.free_threshold; // đổi điểm không làm mất miễn phí ship
  let shipping = { options: [], selected: null, fee: 0, shop_pays: false };
  if (withShipping && lines.length) {
    const cod = input.payment_method === 'cod' ? after : 0;
    const options = (await quoteShipping(env, parcel, input.to || {}, { cod, amount: after })).map((o) => ({ ...o, eta: estimateEta(o.expected, ship.eta) }));
    const selected = options.find((o) => o.id === input.rate_id) || options[0] || null;
    const shopPays = freeship || freeByThreshold;
    shipping = { options, selected, fee: shopPays ? 0 : selected?.fee || 0, shop_pays: shopPays, carrier_fee: selected?.carrier_fee ?? selected?.fee ?? 0 };
  }
  const total = Math.max(0, after + shipping.fee);
  return {
    lines, subtotal, discount, discount_label: discountLabel, voucher: voucher?.code || null,
    points, points_discount: pointsDiscount, points_earn: earnFor(loyalty, after),
    affiliate: affiliate ? { id: affiliate.id, code: affiliate.code, name: affiliate.name, tier: affiliate.tier, status: affiliate.status, parent_id: affiliate.parent_id } : null,
    ref_source: refSource, self_purchase: selfPurchase, parcel, shipping, total, errors,
    free_threshold: ship.free_threshold || 0, free_gap: ship.free_threshold > after + pointsDiscount ? ship.free_threshold - after - pointsDiscount : 0,
  };
}
