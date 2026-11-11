// Ngày giao dự kiến: đọc thời gian giao của hãng ("1-2 ngày", "24 giờ"...) + thời gian chuẩn bị hàng của shop.
// Mọi ngày tính theo giờ Việt Nam (UTC+7).
const VN = 7 * 3600e3;
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const DEFAULT_ETA = { prep_days: 0, cutoff_hour: 15, pickup_sunday: false, fallback_days: [2, 4] };

/** "Dự kiến 2–4 ngày" → [2,4]; "24 giờ" → [1,1]; "3 ngày" → [3,3]; không đọc được → null */
export function parseLeadTime(text) {
  const s = String(text || '').toLowerCase();
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:[-–~đến]+\s*(\d+(?:[.,]\d+)?))?\s*(ngày|day|giờ|h\b|hour|tiếng)/);
  if (!m) return null;
  let a = Number(m[1].replace(',', '.')), b = Number((m[2] || m[1]).replace(',', '.'));
  if (/giờ|h|hour|tiếng/.test(m[3])) { a = Math.max(1, Math.ceil(a / 24)); b = Math.max(1, Math.ceil(b / 24)); }
  if (!(a > 0) || !(b > 0) || b > 30) return null;
  return [Math.round(Math.min(a, b)), Math.round(Math.max(a, b))];
}

const vnDate = (ms) => new Date(ms + VN); // dùng getUTC* để đọc ngày giờ VN
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400e3);

/** Ngày gửi hàng cho hãng: hôm nay nếu trước giờ chốt, không thì hôm sau; bỏ Chủ nhật nếu shop nghỉ */
export function pickupDate(cfg = {}, now = Date.now()) {
  const c = { ...DEFAULT_ETA, ...cfg };
  let d = vnDate(now);
  if (d.getUTCHours() >= Number(c.cutoff_hour)) d = addDays(d, 1);
  for (let i = 0; i < (Number(c.prep_days) || 0); i++) d = addDays(d, 1);
  if (!c.pickup_sunday && d.getUTCDay() === 0) d = addDays(d, 1);
  return d;
}

export function fmtDay(isoDate) {
  const d = new Date(isoDate + 'T00:00:00Z');
  return `${DOW[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** { from, to, text } — from/to là ngày YYYY-MM-DD theo giờ VN */
export function estimateEta(expectedText, cfg = {}, now = Date.now()) {
  const c = { ...DEFAULT_ETA, ...cfg };
  const [a, b] = parseLeadTime(expectedText) || c.fallback_days;
  const p = pickupDate(c, now);
  const from = iso(addDays(p, a)), to = iso(addDays(p, b));
  return { from, to, text: from === to ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(to)}` };
}
