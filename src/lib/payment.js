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

async function call(env, path, opts = {}) {
  const { base, key } = await thuchiConfig(env);
  if (!base || !key) throw new HttpError(503, 'Chưa kết nối web thu chi SePay');
  const r = await fetch(`${base}/api/v1${path}`, {
    ...opts,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status !== 'success') throw new HttpError(r.status === 401 || r.status === 403 ? 502 : 502, d.message || `Web thu chi lỗi HTTP ${r.status}`);
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
