import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommissions, commissionBase, tierFor, walletSummary } from '../src/lib/commission.js';

const tiers = [
  { id: 1, name: 'Thành viên', min_sales: 0, direct: 15, l1: 2, l2: 1 },
  { id: 2, name: 'Đại sứ', min_sales: 5000000, direct: 20, l1: 2, l2: 1 },
  { id: 3, name: 'Trưởng nhóm', min_sales: 20000000, direct: 25, l1: 3, l2: 1 },
];

test('hoa hồng 3 tầng theo hạng của từng người', () => {
  const chain = [{ id: 3, tier: 1 }, { id: 2, tier: 2 }, { id: 1, tier: 3 }];
  const c = buildCommissions(283000, chain, tiers);
  assert.deepEqual(c.map((x) => [x.affiliate_id, x.level, x.rate, x.amount]), [[3, 0, 15, 42450], [2, 1, 2, 5660], [1, 2, 1, 2830]]);
});

test('bỏ qua người bị khoá và cấp trống', () => {
  const c = buildCommissions(100000, [{ id: 9, tier: 3 }, null, { id: 7, tier: 1, status: 'blocked' }], tiers);
  assert.equal(c.length, 1);
  assert.equal(c[0].amount, 25000);
});

test('doanh số tính hoa hồng: trừ giảm giá theo tỷ lệ, bỏ món không tính hoa hồng', () => {
  const items = [{ price: 100000, qty: 2, commissionable: 1 }, { price: 100000, qty: 1, commissionable: 0 }];
  assert.equal(commissionBase(items, 300000, 30000), 180000);
  assert.equal(commissionBase(items, 0, 0), 0);
});

test('xét hạng theo doanh số', () => {
  assert.equal(tierFor(0, tiers).id, 1);
  assert.equal(tierFor(5000000, tiers).id, 2);
  assert.equal(tierFor(25000000, tiers).id, 3);
});

test('ví: số dư = khả dụng − đang rút − đã chi', () => {
  const w = walletSummary(
    [{ amount: 42450, status: 'available' }, { amount: 10000, status: 'pending' }, { amount: 5000, status: 'void' }],
    [{ amount: 20000, status: 'paid' }, { amount: 10000, status: 'requested' }, { amount: 9000, status: 'rejected' }],
  );
  assert.deepEqual(w, { pending: 10000, earned: 42450, requested: 10000, paid: 20000, balance: 12450 });
});
