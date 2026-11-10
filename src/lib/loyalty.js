// Điểm tích luỹ: cộng khi đơn hoàn tất (theo SĐT, kể cả khách chưa có tài khoản),
// trừ lại khi đơn hoàn hàng; đổi điểm giảm giá lúc thanh toán (cần đăng nhập), hoàn điểm khi đơn huỷ.
import { first, run, getSetting } from './db.js';
import { HttpError } from './util.js';

export const DEFAULT_LOYALTY = { enabled: true, earn_per: 10000, point_value: 200, max_redeem_pct: 30, min_redeem: 10 };
const NO_EARN_CHANNELS = ['tiktok', 'shopee'];  // đơn sàn: khách thuộc sàn, SĐT thường bị ẩn

export async function loyaltyConfig(env) {
  const s = (await getSetting(env, 'loyalty', {})) || {};
  const c = { ...DEFAULT_LOYALTY, ...s };
  c.earn_per = Math.max(1000, Number(c.earn_per) || DEFAULT_LOYALTY.earn_per);
  c.point_value = Math.max(1, Number(c.point_value) || DEFAULT_LOYALTY.point_value);
  c.max_redeem_pct = Math.min(100, Math.max(0, Number(c.max_redeem_pct ?? DEFAULT_LOYALTY.max_redeem_pct)));
  c.min_redeem = Math.max(0, Number(c.min_redeem) || 0);
  return c;
}

export const earnFor = (cfg, base) => (cfg.enabled ? Math.floor(Math.max(0, base) / cfg.earn_per) : 0);

// Số điểm tối đa được dùng cho tiền hàng sau giảm giá `base`
export function redeemPlan(cfg, balance, base, want) {
  const cap = Math.floor((Math.max(0, base) * cfg.max_redeem_pct) / 100 / cfg.point_value);
  const max = cfg.enabled && balance >= cfg.min_redeem ? Math.max(0, Math.min(balance, cap)) : 0;
  let use = want === true ? max : Math.min(max, Math.max(0, Math.floor(Number(want) || 0)));
  if (use > 0 && use < cfg.min_redeem) use = 0;
  return { max, use, amount: use * cfg.point_value };
}

async function ledger(env, customerId, orderId, type, points, note, by = 'system') {
  if (!points) return;
  await run(env, 'INSERT INTO points_ledger (customer_id, order_id, type, points, note, created_by) VALUES (?,?,?,?,?,?)', customerId, orderId || null, type, points, note || null, by);
  await run(env, 'UPDATE customers SET points=points+? WHERE id=?', points, customerId);
}

// Trừ điểm ngay khi tạo đơn; trả lỗi nếu số dư không còn đủ (bấm đặt hai lần, hai tab…)
export async function reservePoints(env, customerId, points) {
  if (!points) return;
  const r = await run(env, 'UPDATE customers SET points=points-? WHERE id=? AND points>=?', points, customerId, points);
  if (!r.meta.changes) throw new HttpError(409, 'Số điểm tích luỹ đã thay đổi, vui lòng tải lại trang');
}
export async function recordRedeem(env, customerId, order) {
  await run(env, 'INSERT INTO points_ledger (customer_id, order_id, type, points, note) VALUES (?,?,?,?,?)', customerId, order.id, 'redeem', -order.points_used, `Đổi điểm cho đơn ${order.code}`);
}

// Gọi sau mỗi lần đổi trạng thái đơn
export async function onOrderStatus(env, order, prevStatus, status) {
  const cfg = await loyaltyConfig(env);
  const closing = ['cancelled', 'returned'].includes(status);
  const wasClosed = ['cancelled', 'returned'].includes(prevStatus);
  const payer = order.points_used ? await first(env, "SELECT customer_id FROM points_ledger WHERE order_id=? AND type='redeem' ORDER BY id LIMIT 1", order.id) : null;

  // Điểm đã đổi: hoàn khi huỷ/hoàn hàng, trừ lại nếu đơn được mở lại
  if (payer && closing && !wasClosed) await ledger(env, payer.customer_id, order.id, 'refund', order.points_used, `Hoàn điểm đơn ${order.code} (${status === 'cancelled' ? 'huỷ' : 'hoàn hàng'})`);
  if (payer && !closing && wasClosed) await ledger(env, payer.customer_id, order.id, 'redeem', -order.points_used, `Đơn ${order.code} được mở lại`);

  // Điểm thưởng: cộng khi hoàn tất, thu hồi khi đơn đã hoàn tất bị hoàn hàng/huỷ
  if (status === 'completed' && !order.points_earned && order.customer_id && !NO_EARN_CHANNELS.includes(order.channel)) {
    const pts = earnFor(cfg, order.subtotal - order.discount);
    if (pts > 0) {
      await ledger(env, order.customer_id, order.id, 'earn', pts, `Tích điểm đơn ${order.code}`);
      await run(env, 'UPDATE orders SET points_earned=? WHERE id=?', pts, order.id);
    }
  }
  if (closing && order.points_earned > 0) {
    await ledger(env, order.customer_id, order.id, 'revoke', -order.points_earned, `Thu hồi điểm đơn ${order.code}`);
    await run(env, 'UPDATE orders SET points_earned=0 WHERE id=?', order.id);
  }
}

export async function adjustPoints(env, customerId, points, note, by) {
  const n = Math.trunc(Number(points) || 0);
  if (!n) throw new HttpError(400, 'Nhập số điểm cộng (dương) hoặc trừ (âm)');
  await ledger(env, customerId, null, 'adjust', n, String(note || '').slice(0, 200) || 'Điều chỉnh', by);
}
