// Zalo Mini App chạy trên tên miền của Zalo (h5.zdn.vn) nên cần CORS cho các API công khai.
// Chỉ mở cho cửa hàng (catalog, giỏ, đặt hàng, đơn, địa chỉ); quản trị, tài khoản, CTV vẫn chỉ dùng cùng tên miền.
export const CORS_PATHS = /^\/api\/(catalog|cart\/quote|checkout|orders\/DL\d{6}|geo\/(cities|districts|wards)|lot\/[A-Za-z0-9-]+|contact|version)$/;
export function corsOrigin(origin) {
  if (!origin) return null;
  if (/^(https|zbrowser):\/\/h5\.(zdn|zadn)\.vn$/.test(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
export function withCors(res, origin) {
  const h = new Headers(res.headers);
  h.set('access-control-allow-origin', origin);
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  h.set('access-control-allow-headers', 'content-type');
  h.set('access-control-max-age', '86400');
  h.append('vary', 'Origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
