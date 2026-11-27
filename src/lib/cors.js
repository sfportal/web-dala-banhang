// Zalo Mini App chạy trên tên miền của Zalo (h5.zdn.vn) nên cần CORS cho các API công khai.
// Mở cho cửa hàng (catalog, giỏ, đặt hàng, đơn, địa chỉ), đăng nhập bằng SĐT Zalo, tài khoản khách và CTV.
// Tài khoản, CTV từ mini app chỉ xác thực bằng header Authorization (không gửi cookie), nên không có rủi ro CSRF. Quản trị không mở.
export const CORS_PATHS = /^\/api\/(catalog|cart\/quote|checkout|orders\/DL\d{6}|geo\/(cities|districts|wards)|lot\/[A-Za-z0-9-]+|contact|version|zalo\/(login|location)|account\/(me|orders|points|affiliate|logout)|aff\/(me|orders|team|withdraw|profile))$/;
export function corsOrigin(origin) {
  if (!origin) return null;
  if (/^(https|zbrowser):\/\/h5\.(zdn|zadn)\.vn$/.test(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
export function withCors(res, origin) {
  const h = new Headers(res.headers);
  h.set('access-control-allow-origin', origin);
  h.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS');
  h.set('access-control-allow-headers', 'content-type, authorization');
  h.set('access-control-max-age', '86400');
  h.append('vary', 'Origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
