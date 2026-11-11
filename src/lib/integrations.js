// Trạng thái tích hợp qua web Thu-Chi: một API key dùng cho thanh toán SePay, Goship và OTP eSMS.
import { thuchiConfig, thuchiCall } from './payment.js';
import { getSetting } from './db.js';

const envLabel = (e) => (e === 'production' ? 'production' : e ? 'sandbox' : null);
async function attempt(fn) {
  const t = Date.now();
  try { return { ok: true, data: await fn(), ms: Date.now() - t }; } catch (e) { return { ok: false, error: e.status === 404 ? `${e.message} (Thu-Chi đang chạy chưa có API này, cần deploy bản Thu-Chi mới)` : e.message, code: e.status || null, ms: Date.now() - t }; }
}

export async function integrationStatus(env) {
  const tc = await thuchiConfig(env);
  const out = { checked_at: new Date().toISOString(), thuchi: { base: tc.base || null, key_set: !!tc.key, configured: tc.enabled } };
  if (!tc.enabled) {
    const msg = !tc.base ? 'Chưa nhập địa chỉ hệ thống Thu-Chi' : 'Chưa nhập API key Thu-Chi';
    return { ...out, thuchi: { ...out.thuchi, ok: false, error: msg }, payment: { ok: false, error: msg }, goship: { ok: false, error: msg }, otp: { ok: false, error: msg } };
  }
  const ship = (await getSetting(env, 'shipping', {})) || {};
  const auth = (await getSetting(env, 'auth', {})) || {};

  // 1. Kết nối + quyền của key (GET /ping). Bản Thu-Chi cũ chưa có /ping thì suy ra từ các API khác.
  const ping = await attempt(() => thuchiCall(env, '/ping'));
  const perm = ping.ok ? ping.data.permissions || {} : null;
  out.thuchi = { ...out.thuchi, ok: ping.ok || ping.code === 404, latency_ms: ping.ms, key_name: ping.data?.api_key?.name || null,
    permissions: perm, ping_api: ping.ok, error: ping.ok || ping.code === 404 ? null : ping.error };
  if (!out.thuchi.ok) return { ...out, payment: { ok: false, error: ping.error }, goship: { ok: false, error: ping.error }, otp: { ok: false, error: ping.error } };

  // Trạng thái chi tiết từ Thu-Chi (GET /status: môi trường và tình trạng từng tài khoản). Bản cũ chưa có thì bỏ qua.
  const st = await attempt(() => thuchiCall(env, '/status'));
  const I = st.ok ? st.data.integrations || {} : {};
  out.thuchi.status_api = st.ok;
  const health = (kind, id) => (I[kind]?.accounts || []).find((a) => String(a.id) === String(id)) || null;
  const pickHealth = (h) => (h ? { environment: h.environment || null, active: h.active, configured: h.configured, healthy: h.healthy ?? null, message: h.message || null, checked_at: h.health_checked_at || null } : null);

  // 2. Thanh toán SePay: tài khoản ngân hàng nhận tiền + quyền tạo yêu cầu thu
  const acc = await attempt(() => thuchiCall(env, '/accounts'));
  out.payment = acc.ok
    ? { ok: acc.data.length > 0 && perm?.payment_requests !== false, can_create: perm ? !!perm.payment_requests : null,
      accounts: acc.data.map((a) => ({ account_number: a.account_number, bank: a.bank, holder: a.holder, label: a.label, last_transaction: a.last_transaction, env: envLabel(a.env) })),
      error: !acc.data.length ? 'API key chưa được xem tài khoản ngân hàng nào' : perm && !perm.payment_requests ? 'API key chưa có quyền tạo yêu cầu thu tiền' : null }
    : { ok: false, error: acc.error };
  if (I.sepay) {
    const sp = I.sepay;
    const bad = (sp.accounts || []).find((a) => a.healthy === false);
    out.payment.sepay = { enabled: !!sp.enabled, environment: (sp.accounts || [])[0]?.environment || null, accounts: (sp.accounts || []).map((a) => ({ id: a.id, name: a.name, ...pickHealth(a) })),
      last_webhook_at: sp.last_webhook_at || null, last_webhook_ok: sp.last_webhook_ok ?? null, last_sync_at: sp.last_sync_at || null };
    if (!sp.enabled) { out.payment.ok = false; out.payment.error = 'SePay chưa bật bên Thu-Chi'; }
    else if (bad) { out.payment.ok = false; out.payment.error = `SePay: ${bad.message || 'kiểm tra kết nối thất bại'}`; }
  }

  // 3. Goship: tài khoản (môi trường Thật/Sandbox) + gọi thử danh sách tỉnh
  if (perm && !perm.goship) out.goship = { ok: false, error: 'API key chưa được cấp quyền Goship' };
  else {
    const g = await attempt(() => thuchiCall(env, '/goship/accounts'));
    if (!g.ok) out.goship = { ok: false, error: g.error };
    else if (!g.data.length) out.goship = { ok: false, accounts: [], error: 'Thu-Chi chưa có tài khoản Goship nào cho API key này' };
    else {
      const sel = g.data.find((a) => String(a.id) === String(ship.thuchi_account_id || '')) || g.data[0];
      const q = sel ? `?account_id=${sel.id}` : '';
      const cities = await attempt(() => thuchiCall(env, '/goship/cities' + q));
      const hs = health('goship', sel?.id);
      out.goship = { ok: cities.ok && Array.isArray(cities.data) && cities.data.length > 0 && hs?.healthy !== false, selected: sel?.id || null, env: envLabel(hs?.environment || sel?.env),
        accounts: g.data.map((a) => { const h = health('goship', a.id); return { id: a.id, name: a.name, env: envLabel(h?.environment || a.env), sender: a.sender || null, sender_ready: h?.sender_ready ?? null, health: pickHealth(h) }; }),
        cities: cities.ok ? cities.data.length : 0, latency_ms: cities.ms,
        error: !cities.ok ? cities.error : !cities.data.length ? 'Goship trả về danh sách tỉnh trống' : hs?.healthy === false ? `Goship: ${hs.message || 'kiểm tra thất bại'}` : null };
    }
  }

  // 4. OTP eSMS: tài khoản, kênh đã cấu hình, sandbox
  if (perm && !perm.otp) out.otp = { ok: false, error: 'API key chưa được cấp quyền Xác minh SĐT' };
  else {
    const o = await attempt(() => thuchiCall(env, '/otp/accounts'));
    if (!o.ok) out.otp = { ok: false, error: o.error };
    else if (!o.data.length) out.otp = { ok: false, accounts: [], error: 'Thu-Chi chưa có tài khoản eSMS nào cho API key này' };
    else {
      const sel = o.data.find((a) => String(a.id) === String(auth.thuchi_account_id || '')) || o.data[0];
      const chan = auth.channel || 'zalo_sms';
      const chanOk = (sel.channels || []).includes(chan);
      const hs = health('esms', sel.id);
      out.otp = { ok: chanOk && hs?.healthy !== false, selected: sel.id, env: hs?.environment || (sel.sandbox ? 'sandbox' : 'production'), channel: chan,
        accounts: o.data.map((a) => { const h = health('esms', a.id); return { id: a.id, name: a.name, channels: a.channels || [], default_channel: a.default_channel, env: h?.environment || (a.sandbox ? 'sandbox' : 'production'), health: pickHealth(h) }; }),
        error: !chanOk ? `Tài khoản eSMS "${sel.name}" chưa cấu hình kênh ${chan === 'zalo_sms' ? 'Zalo + SMS' : chan === 'zalo' ? 'Zalo' : 'SMS'}` : hs?.healthy === false ? `eSMS: ${hs.message || 'kiểm tra thất bại'}` : null };
    }
  }
  return out;
}
