// Gọi API của website DaLa (dùng chung máy chủ, sản phẩm, đơn hàng). Không giữ giá ở mini app: giá luôn do máy chủ tính.
export const API_BASE = (import.meta.env.VITE_API_BASE || 'https://dala-shop.sfportal.workers.dev').replace(/\/+$/, '');
export const OA_ID: string = import.meta.env.VITE_OA_ID || '';
export const HOTLINE: string = import.meta.env.VITE_HOTLINE || '';

export type Flash = { item_id: number; price: number; quota: number; sold: number; left: number | null; per_order: number | null; ends_at: string };
export type Product = {
  id: number; sku: string; slug: string; name: string; subtitle?: string; line: string; kind: string;
  price: number; effective_price: number; ref_price: number | null; save_pct: number; stock: number;
  image?: string; short_desc?: string; story?: string; benefits?: string[]; usage?: string; ingredients?: string; weight?: string;
  badges?: string[]; personas?: string[]; flash: Flash | null; components?: { sku: string; qty: number; name?: string; subtitle?: string; image?: string }[];
};
export type Catalog = { products: Product[]; flash: { id: number; name: string; ends_at: string } | null; next_flash: { name: string; starts_at: string } | null };
export type CartItem = { sku: string; qty: number };
export type ShipOption = { id: string; carrier: string; service?: string; fee: number; logo?: string; eta?: { text: string }; expected?: string };
export type QuoteLine = { sku: string; name: string; subtitle?: string; image?: string; price: number; qty: number; flash: boolean };
export type Quote = {
  lines: QuoteLine[]; subtotal: number; discount: number; discount_label?: string | null; total: number; errors: string[];
  shipping: { options: ShipOption[]; selected: ShipOption | null; fee: number; shop_pays: boolean };
  free_gap?: number; points_earn?: number; affiliate?: { code: string; name: string } | null;
};
export type Destination = { city?: string; district?: string; ward?: string; province?: string; city_name?: string; district_name?: string; ward_name?: string };
export type GeoItem = { id: string; name: string };
export type Order = {
  code: string; status: string; status_label: string; payment_status: string; payment_label: string; payment_method: 'cod' | 'sepay';
  total: number; subtotal: number; discount: number; shipping_fee: number; paid_amount: number | null;
  payment_code: string | null; payment_qr: string | null; payment_account: string | null; payment_bank: string | null; bank_holder: string | null;
  manual_payment: boolean; name: string; phone: string; address: string; province: string | null;
  tracking_code: string | null; tracking_url: string | null; ship_status_text: string | null; shipping_carrier: string | null;
  created_at: string; expire_minutes: number; eta: { text: string; late?: boolean } | null;
  timeline: { kind: string; code: string; title: string; detail: string | null; location: string | null; at: string }[];
  items: { sku: string; name: string; price: number; qty: number; image: string | null }[];
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(API_BASE + path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let d: any = null;
  try { d = await r.json(); } catch { /* máy chủ trả về không phải JSON */ }
  if (!r.ok) throw new Error(d?.error || 'Không kết nối được DaLa, vui lòng thử lại');
  return d as T;
}

export const api = {
  catalog: () => call<Catalog>('/api/catalog'),
  quote: (b: object) => call<Quote>('/api/cart/quote', b),
  checkout: (b: object) => call<{ code: string; token: string; total: number; payment_method: string }>('/api/checkout', b),
  order: (code: string, token: string, check = false) => call<Order>(`/api/orders/${code}?t=${encodeURIComponent(token)}${check ? '&check=1' : ''}`),
  cities: () => call<{ source: string; items: GeoItem[] }>('/api/geo/cities').catch(() => ({ source: 'static', items: [] as GeoItem[] })),
  districts: (city: string) => call<{ items: GeoItem[] }>('/api/geo/districts?city=' + encodeURIComponent(city)).catch(() => ({ items: [] as GeoItem[] })),
  wards: (d: string) => call<{ items: GeoItem[] }>('/api/geo/wards?district=' + encodeURIComponent(d)).catch(() => ({ items: [] as GeoItem[] })),
};

// Ảnh trên website là đường dẫn tương đối (/assets/img/...), mini app cần địa chỉ đầy đủ
export const img = (u?: string | null, small = false) => {
  if (!u) return '';
  const full = /^https?:/.test(u) ? u : API_BASE + u;
  return small ? full.replace(/\.webp$/, '-sm.webp') : full;
};
export const vnd = (n: number | null | undefined) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
export const when = (t: string) => {
  const d = new Date(String(t).replace(' ', 'T') + (/[zZ+]/.test(t) ? '' : 'Z'));
  return isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Gộp các dòng bị tách theo Flash Sale thành một dòng hiển thị
export function groupLines(lines: QuoteLine[]) {
  const m = new Map<string, QuoteLine & { amount: number; flashQty: number }>();
  for (const l of lines) {
    const g = m.get(l.sku) || { ...l, qty: 0, amount: 0, flashQty: 0 };
    g.qty += l.qty; g.amount += l.price * l.qty; if (l.flash) g.flashQty += l.qty;
    m.set(l.sku, g);
  }
  return [...m.values()];
}
