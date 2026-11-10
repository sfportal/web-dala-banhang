// Hoa hồng cộng tác viên 3 tầng: trực tiếp (F0), gián tiếp 1 (người tuyển F0), gián tiếp 2 (người tuyển của người tuyển)
// Hàm thuần, không đụng DB: dễ kiểm thử.

export const LEVEL_NAMES = ['Trực tiếp', 'Gián tiếp 1', 'Gián tiếp 2'];

export function tierFor(sales, tiers) {
  const sorted = [...tiers].sort((a, b) => a.min_sales - b.min_sales);
  let t = sorted[0];
  for (const x of sorted) if (sales >= x.min_sales) t = x;
  return t;
}

export function tierById(tiers, id) {
  return tiers.find((t) => Number(t.id) === Number(id)) || tiers[0];
}

// Doanh số tính hoa hồng của đơn: hàng được tính hoa hồng, đã trừ giảm giá theo tỷ lệ, không tính phí ship
export function commissionBase(items, subtotal, discount) {
  const eligible = items.filter((i) => i.commissionable !== 0).reduce((s, i) => s + i.price * i.qty, 0);
  if (!subtotal || eligible <= 0) return 0;
  const ratio = Math.max(0, 1 - (discount || 0) / subtotal);
  return Math.round(eligible * ratio);
}

/**
 * chain: [cộng tác viên trực tiếp, cấp trên 1, cấp trên 2] (phần tử có thể null)
 * mỗi phần tử: { id, tier, status }
 */
export function buildCommissions(base, chain, tiers) {
  const out = [];
  const keys = ['direct', 'l1', 'l2'];
  for (let level = 0; level < 3; level++) {
    const a = chain[level];
    if (!a || a.status === 'blocked') continue;
    const t = tierById(tiers, a.tier);
    const rate = Number(t[keys[level]] || 0);
    if (rate <= 0 || base <= 0) continue;
    out.push({ affiliate_id: a.id, level, tier: t.id, base, rate, amount: Math.round((base * rate) / 100) });
  }
  return out;
}

// Ví hoa hồng: số dư rút được = hoa hồng khả dụng - các lệnh rút chưa bị từ chối
export function walletSummary(commissions, withdrawals) {
  const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
  const pending = sum(commissions.filter((c) => c.status === 'pending'));
  const available = sum(commissions.filter((c) => c.status === 'available'));
  const requested = sum(withdrawals.filter((w) => w.status === 'requested' || w.status === 'approved'));
  const paid = sum(withdrawals.filter((w) => w.status === 'paid'));
  return { pending, earned: available, requested, paid, balance: Math.max(0, available - requested - paid) };
}
