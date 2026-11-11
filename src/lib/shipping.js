// Phí giao hàng: Goship API v2 (tra cước mọi hãng trên tuyến) + bảng phí dự phòng khi chưa kết nối
// Tất cả gọi qua web Thu-Chi: https://sepay-thuchi.minhducuy.workers.dev/docs#goship
import { all, first, run, getSetting } from './db.js';
import { HttpError } from './util.js';
import { thuchiConfig, thuchiCall } from './payment.js';

export const PROVINCES_34 = ['Hà Nội', 'TP. Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ', 'Huế', 'Đắk Lắk', 'Gia Lai', 'Lâm Đồng', 'Khánh Hòa',
  'Quảng Ngãi', 'Quảng Trị', 'Đồng Nai', 'Tây Ninh', 'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Cà Mau', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh',
  'Ninh Bình', 'Hưng Yên', 'Bắc Ninh', 'Quảng Ninh', 'Lạng Sơn', 'Cao Bằng', 'Thái Nguyên', 'Tuyên Quang', 'Lào Cai', 'Phú Thọ',
  'Sơn La', 'Điện Biên', 'Lai Châu'];
const NEAR = ['Đắk Lắk', 'Gia Lai', 'Lâm Đồng', 'Khánh Hòa'];

/**
 * Gộp các món thành 1 kiện: cộng khối lượng, xếp chồng thể tích, cộng đệm nếu có hàng dễ vỡ.
 * items: [{ qty, weight_g, length_cm, width_cm, height_cm, fragile }]
 */
export function buildParcel(items, cfg = {}) {
  const pack = Number(cfg.packaging_weight ?? 120);
  const pad = Number(cfg.fragile_padding_cm ?? 2);
  let weight = 0, volume = 0, L = 0, W = 0, fragile = false;
  for (const i of items) {
    const q = Math.max(1, Number(i.qty) || 1);
    weight += (Number(i.weight_g) || 300) * q;
    const l = Number(i.length_cm) || 15, w = Number(i.width_cm) || 10, h = Number(i.height_cm) || 10;
    volume += l * w * h * q;
    L = Math.max(L, l); W = Math.max(W, w);
    if (i.fragile) fragile = true;
  }
  weight += pack + (fragile ? 150 : 0);
  volume *= 1.1; // khoảng hở khi xếp hộp
  // xếp gần khối lập phương nhưng không nhỏ hơn món lớn nhất
  const side = Math.cbrt(volume);
  L = Math.max(L, side); W = Math.max(W, Math.min(L, side));
  let H = Math.max(1, Math.ceil(volume / (L * W || 1)));
  if (fragile) { L += pad * 2; W += pad * 2; H += pad * 2; }
  return { weight: Math.round(weight), length: Math.ceil(L), width: Math.ceil(W), height: Math.ceil(H), fragile };
}

// Cân nặng quy đổi (Goship: D×R×C / 6000, đơn vị cm → kg)
export const volumetricGram = (p) => Math.round((p.length * p.width * p.height) / 6000 * 1000);

export function fallbackQuote(parcel, province, cfg = {}) {
  const table = cfg.fallback_table || [[500, 25000], [1000, 30000], [2000, 38000]];
  const step = Number(cfg.fallback_step_500g ?? 5000);
  const w = Math.max(parcel.weight, volumetricGram(parcel));
  let fee = table[table.length - 1][1];
  const hit = table.find(([max]) => w <= max);
  if (hit) fee = hit[1];
  else fee += Math.ceil((w - table[table.length - 1][0]) / 500) * step;
  if (NEAR.includes(province)) fee = Math.max(15000, fee - 5000);
  if (parcel.fragile) fee += Number(cfg.fragile_fee ?? 10000);
  return [{ id: 'fallback', carrier: 'Giao hàng tiêu chuẩn', logo: null, service: 'Tiêu chuẩn', expected: NEAR.includes(province) ? 'Dự kiến 1–2 ngày' : 'Dự kiến 2–4 ngày', fee, cod_fee: 0, source: 'fallback' }];
}

// ---------------------------------------------------------------- Goship client
// Goship chỉ đi qua API web Thu-Chi (/api/v1/goship): website không giữ token Goship.
export async function goshipConfig(env) {
  const cfg = (await getSetting(env, 'shipping', {})) || {};
  const enabled = (await thuchiConfig(env)).enabled && cfg.goship_enabled !== false;
  return { cfg, provider: 'thuchi', enabled, accountId: Number(cfg.thuchi_account_id) || undefined };
}

async function goship(env, path, { method = 'GET', body } = {}) {
  const c = await goshipConfig(env);
  const q = c.accountId && method === 'GET' ? (path.includes('?') ? '&' : '?') + 'account_id=' + c.accountId : '';
  return thuchiCall(env, '/goship' + path + q, { method, body: body ? { ...body, account_id: c.accountId } : undefined });
}

// Danh sách trả về có thể nằm ở data hoặc data.data
const listOf = (d) => (Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.data) ? d.data.data : Array.isArray(d) ? d : []);

async function cached(env, key, days, loader) {
  const row = await first(env, 'SELECT data, updated_at FROM geo_cache WHERE key=?', key);
  if (row && Date.now() - new Date(row.updated_at.replace(' ', 'T') + 'Z').getTime() < days * 86400e3) return JSON.parse(row.data);
  const data = await loader();
  await run(env, "INSERT INTO geo_cache (key, data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at", key, JSON.stringify(data));
  return data;
}

// Khi Goship lỗi: trang thanh toán vẫn chọn được tỉnh (danh sách 34 tỉnh) và tính phí theo bảng dự phòng
const STATIC_CITIES = () => PROVINCES_34.map((n) => ({ id: n, name: n }));
export async function listCities(env, { strict = false } = {}) {
  const { enabled } = await goshipConfig(env);
  if (!enabled) return { source: 'static', items: STATIC_CITIES() };
  try {
    const items = await cached(env, 'cities', 30, async () => {
      const list = listOf(await goship(env, '/cities')).map((c) => ({ id: String(c.id), name: c.name }));
      if (!list.length) throw new HttpError(502, 'Goship trả về danh sách tỉnh trống');
      return list;
    });
    return { source: 'goship', items };
  } catch (e) {
    console.error('goship cities', e.message);
    if (strict) throw e;
    return { source: 'static', items: STATIC_CITIES(), error: e.message };
  }
}
export async function listDistricts(env, city) {
  return cached(env, 'd:' + city, 30, async () => listOf(await goship(env, `/cities/${encodeURIComponent(city)}/districts`)).map((d) => ({ id: String(d.id), name: d.name })));
}
export async function listWards(env, district) {
  return cached(env, 'w:' + district, 30, async () => listOf(await goship(env, `/districts/${encodeURIComponent(district)}/wards`)).map((w) => ({ id: String(w.id), name: w.name })));
}

export function normalizeRate(r, fragileFee = 0) {
  const total = Number(r.total_amount ?? 0) > 0 ? Number(r.total_amount) : Number(r.total_fee || 0) + Number(r.cod_fee || 0);
  return {
    id: r.id || r.rate, carrier: r.carrier_name, logo: r.carrier_logo, short: r.carrier_short_name, service: r.service,
    expected: r.expected, fee: Math.round(total + fragileFee), carrier_fee: Math.round(total), cod_fee: Number(r.cod_fee || 0),
    success: r.report?.success_percent ?? null, source: 'goship',
  };
}

/**
 * Báo giá giao hàng cho giỏ: trả danh sách lựa chọn (rẻ nhất đứng đầu).
 * to: { city, district, ward, province } ; cod: số tiền thu hộ ; amount: giá trị khai giá
 */
export async function quoteShipping(env, parcel, to, { cod = 0, amount = 0 } = {}) {
  const { cfg, enabled, provider } = await goshipConfig(env);
  const fragileFee = parcel.fragile ? Number(cfg.fragile_fee ?? 10000) : 0;
  // Qua Thu-Chi có thể bỏ trống địa chỉ lấy hàng: dùng địa chỉ mặc định của tài khoản Goship bên Thu-Chi
  const from = cfg.origin?.district ? { city: cfg.origin.city, district: cfg.origin.district, ward: cfg.origin.ward || undefined } : undefined;
  if (!enabled || !to?.district || false) return fallbackQuote(parcel, to?.province || to?.city_name, cfg);
  try {
    const d = await goship(env, '/rates', {
      method: 'POST',
      body: {
        address_from: from,
        address_to: { city: to.city, district: to.district, ward: to.ward || undefined },
        parcel: { cod: Math.round(cod), amount: Math.round(amount), weight: parcel.weight, width: parcel.width, height: parcel.height, length: parcel.length },
      },
    });
    const list = listOf(d).map((r) => normalizeRate(r, fragileFee)).filter((r) => r.id && r.fee > 0);
    if (!list.length) return fallbackQuote(parcel, to?.province, cfg);
    list.sort((a, b) => a.fee - b.fee);
    return list.slice(0, 6);
  } catch (e) {
    console.error('goship rates', e.message);
    return fallbackQuote(parcel, to?.province, cfg);
  }
}

// Tạo vận đơn Goship cho đơn hàng (rate phải lấy mới tại thời điểm tạo)
export async function createShipment(env, order, rateId) {
  const { cfg, provider } = await goshipConfig(env);
  const o = cfg.origin || {};
  const parcel = JSON.parse(order.parcel_dims || '{}');
  const cod = order.payment_method === 'cod' && order.payment_status !== 'paid' ? order.total : 0;
  const from = o.district ? { name: o.name, phone: o.phone, street: o.street, city: o.city, district: o.district, ward: o.ward } : undefined;
  const d = await goship(env, '/shipments', {
    method: 'POST',
    body: {
      rate: rateId, payer: 1, order_id: order.code, address_from: from,
      address_to: { name: order.name, phone: order.phone, street: order.address, city: order.city_code, district: order.district_code, ward: order.ward_code },
      parcel: {
        cod, amount: Math.min(order.subtotal, 5000000), weight: order.parcel_weight || parcel.weight || 500,
        width: parcel.width || 15, height: parcel.height || 10, length: parcel.length || 20,
        metadata: [order.fragile ? 'HÀNG DỄ VỠ, vui lòng nhẹ tay, không quăng ném.' : '', 'Cho xem hàng, không thử.', order.note || ''].filter(Boolean).join(' '),
      },
    },
  });
  return normalizeShipment(d?.data && !d.gcode && !d.id ? d.data : d);
}

// Vận đơn về một dạng chung (Thu-Chi trả gcode/carrier_code/status; Goship trực tiếp trả id/tracking_number/shipment_status)
export function normalizeShipment(d = {}) {
  const status = d.status ?? d.shipment_status ?? null;
  return {
    gcode: d.gcode || d.id || null, tracking_number: d.carrier_code || d.tracking_number || null, carrier: d.carrier || d.carrier_name || null,
    fee: Number(d.fee) || null, status: status == null || status === '' ? null : Number(status) || status, status_text: d.status_text || d.shipment_status_txt || null,
    status_desc: d.status_desc || null, tracking_url: d.tracking_url || null, order_id: d.order_id || null, updated_at: d.updated_at || null,
    carrier_error: d.carrier_error || null,
  };
}

// Thu-Chi không gọi webhook về website: lấy các vận đơn thay đổi kể từ lần trước (chạy trong cron 5 phút)
export async function listShipmentUpdates(env, since) {
  const c = await goshipConfig(env);
  if (!c.enabled) return { items: [], last: since };
  const items = []; let last = since;
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({ per_page: '100', page: String(page) });
    if (since) q.set('updated_since', since);
    if (c.accountId) q.set('account_id', String(c.accountId));
    const { data, meta } = await thuchiCall(env, '/goship/shipments?' + q, { withMeta: true });
    for (const s of data || []) { items.push(normalizeShipment(s)); if (s.updated_at && (!last || s.updated_at > last)) last = s.updated_at; }
    if (!meta?.pagination?.has_more) break;
  }
  return { items, last };
}

export async function getShipment(env, gcode, refresh = false) {
  return normalizeShipment(await thuchiCall(env, `/goship/shipments/${encodeURIComponent(gcode)}${refresh ? '?refresh=1' : ''}`));
}

export async function listGoshipAccounts(env) {
  return thuchiCall(env, '/goship/accounts');
}

export const GOSHIP_STATUS = {
  900: 'Đơn mới', 901: 'Chờ lấy hàng', 902: 'Đang lấy hàng', 903: 'Đã lấy hàng', 904: 'Đang giao', 905: 'Giao thành công',
  906: 'Giao thất bại', 907: 'Đang chuyển hoàn', 908: 'Đã chuyển hoàn', 909: 'Đã đối soát', 910: 'Đã đối soát khách', 911: 'Đã trả COD',
  912: 'Chờ thanh toán COD', 913: 'Hoàn thành', 914: 'Đơn huỷ', 915: 'Chậm lấy/giao', 916: 'Giao một phần', 917: 'Thất lạc', 918: 'Lưu kho', 919: 'Đang vận chuyển', 1000: 'Đơn lỗi',
};
