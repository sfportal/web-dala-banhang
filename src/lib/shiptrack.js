// Cập nhật trạng thái vận đơn vào đơn hàng khi đồng bộ từ web Thu-Chi.
import { first, run, getSetting, setSetting } from './db.js';
import { setOrderStatus, logOrderEvent } from './orders.js';
import { GOSHIP_STATUS, listShipmentUpdates, getShipment } from './shipping.js';

const SKIP_LOG = [909, 910, 911, 912]; // mốc đối soát nội bộ, khách không cần thấy

/** upd: { gcode, tracking_number, status, status_text, status_desc, location, tracking_url, fee, at (UTC 'YYYY-MM-DD HH:mm:ss') } */
export async function applyShipmentUpdate(env, o, upd) {
  const st = Number(upd.status);
  const text = upd.status_text || GOSHIP_STATUS[st] || null;
  await run(env, `UPDATE orders SET ship_status=?, ship_status_text=?, tracking_code=COALESCE(?, tracking_code), tracking_url=COALESCE(?, tracking_url),
    goship_id=COALESCE(goship_id, ?), shipping_cost=COALESCE(?, shipping_cost), updated_at=datetime('now') WHERE id=?`,
  Number.isFinite(st) ? String(st) : null, text, upd.tracking_number || null, upd.tracking_url || null, upd.gcode || null, Number(upd.fee) || null, o.id);
  if (!Number.isFinite(st)) return;
  if (!SKIP_LOG.includes(st)) {
    await logOrderEvent(env, o.id, { kind: 'ship', code: st, title: text || 'Cập nhật vận chuyển', detail: upd.status_desc || null, location: upd.location || null, source: 'goship', at: upd.at || null });
  }
  if ([902, 903, 904, 919].includes(st) && ['new', 'confirmed'].includes(o.status)) await setOrderStatus(env, o, 'shipping', 'Goship');
  else if ([905, 913].includes(st) && o.status !== 'completed') await setOrderStatus(env, o, 'completed', 'Goship');
  else if (st === 908 && o.status !== 'returned') await setOrderStatus(env, o, 'returned', 'Goship');
}

const changed = (o, s) => String(o.ship_status ?? '') !== String(s.status ?? '') || (s.tracking_number && s.tracking_number !== o.tracking_code);

/** Cron: lấy vận đơn thay đổi từ Thu-Chi kể từ lần trước, cập nhật đơn tương ứng */
export async function syncShipments(env) {
  const state = (await getSetting(env, 'ship_sync', {})) || {};
  const { items, last } = await listShipmentUpdates(env, state.since || null);
  let n = 0;
  for (const s of items) {
    const o = await first(env, 'SELECT * FROM orders WHERE goship_id=? OR code=?', s.gcode || '', s.order_id || '');
    if (!o || !changed(o, s)) continue;
    await applyShipmentUpdate(env, o, { ...s, at: s.updated_at || null });
    n++;
  }
  if (last && last !== state.since) await setSetting(env, 'ship_sync', { since: last, at: new Date().toISOString() });
  return n;
}

/** Khách mở trang đơn: hỏi lại trạng thái nếu lần cập nhật cuối đã quá 10 phút */
export async function refreshOrderShipment(env, o) {
  if (!o.goship_id || ['completed', 'cancelled', 'returned'].includes(o.status)) return o;
  const age = Date.now() - Date.parse(String(o.updated_at).replace(' ', 'T') + 'Z');
  if (age < 10 * 60e3) return o;
  try {
    const s = await getShipment(env, o.goship_id, true);
    if (s && changed(o, s)) await applyShipmentUpdate(env, o, { ...s, at: s.updated_at || null });
    else await run(env, "UPDATE orders SET updated_at=datetime('now') WHERE id=?", o.id);
    return first(env, 'SELECT * FROM orders WHERE id=?', o.id);
  } catch (e) { console.error('refresh shipment', o.code, e.message); return o; }
}
