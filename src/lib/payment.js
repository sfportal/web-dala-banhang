// Thanh toán online qua web thu chi SePay (sfportal/web-thu-chi, API v1 tại /docs)
// Luồng: tạo yêu cầu thu (POST /api/v1/payment-requests) → khách quét VietQR → SePay báo webhook về web thu chi
// → DaLa hỏi trạng thái (GET /api/v1/payment-requests/{code}) khi khách đang mở trang và mỗi 5 phút bằng cron.
import { getSecret, getSetting } from './db.js';
import { HttpError } from './util.js';

export async function thuchiConfig(env) {
  const pay = (await getSetting(env, 'payment', {})) || {};
  const base = String(pay.thuchi_base || env.THUCHI_BASE_URL || '').replace(/\/+$/, '');
  const key = await getSecret(env, 'thuchi_api_key', 'THUCHI_API_KEY');
  return { base, key, enabled: !!(base && key), pay };
}

// Gọi API v1 của web Thu-Chi (dùng chung cho thanh toán, vận chuyển Goship và OTP)
export async function thuchiCall(env, path, opts = {}) {
  if (opts.body && typeof opts.body !== 'string') opts = { ...opts, body: JSON.stringify(opts.body) };
  return call(env, path, opts);
}

async function call(env, path, opts = {}) {
  const { base, key } = await thuchiConfig(env);
  if (!base || !key) throw new HttpError(503, 'Chưa kết nối web thu chi SePay');
  // Worker gọi Worker khác cùng tài khoản qua *.workers.dev bị Cloudflare trả 404 (lỗi 1042),
  // nên khi có service binding THUCHI thì gọi thẳng qua binding.
  const viaBinding = env.THUCHI && /\.workers\.dev$/i.test(new URL(base).hostname);
  const doFetch = viaBinding ? (u, o) => env.THUCHI.fetch(u, o) : fetch;
  const r = await doFetch(`${base}/api/v1${path}`, {
    ...opts,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== 'success') {
    const msg = d.message || `Web thu chi lỗi HTTP ${r.status}`;
    // 401/403: key sai hoặc thiếu quyền → báo rõ cho quản trị; 422/429 giữ nguyên để hiển thị
    const code = r.status === 401 ? 502 : r.status === 403 ? 403 : [409, 422, 429].includes(r.status) ? r.status : 502;
    throw new HttpError(code, r.status === 403 ? `API key Thu-Chi chưa có quyền này: ${msg}` : msg);
  }
  if (opts.withMeta) return { data: d.data, meta: d.meta };
  return d.data;
}

export async function createPaymentRequest(env, order) {
  return call(env, '/payment-requests', {
    method: 'POST',
    body: JSON.stringify({ amount: order.total, customer: order.name, description: `DaLa ${order.code}` }),
  });
}

export const getPaymentRequest = (env, code) => call(env, `/payment-requests/${encodeURIComponent(code)}`);

export async function testConnection(env) {
  const accounts = await call(env, '/accounts');
  return { ok: true, accounts: accounts.length };
}

// VietQR dự phòng khi chưa nối web thu chi: chuyển khoản thủ công, quản trị xác nhận tay
export function manualQr(bank, order) {
  if (!bank?.account || !bank?.bank) return null;
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bank)}-${encodeURIComponent(bank.account)}-compact2.png?amount=${order.total}&addInfo=${encodeURIComponent(order.code)}&accountName=${encodeURIComponent(bank.holder || '')}`;
}
