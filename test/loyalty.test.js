import test from 'node:test';
import assert from 'node:assert/strict';
import { earnFor, redeemPlan, DEFAULT_LOYALTY } from '../src/lib/loyalty.js';

const cfg = { ...DEFAULT_LOYALTY }; // 10.000đ = 1 điểm, 1 điểm = 200đ, tối đa 30%, tối thiểu 10 điểm

test('tích điểm theo tiền hàng sau giảm giá', () => {
  assert.equal(earnFor(cfg, 283000), 28);
  assert.equal(earnFor(cfg, 9999), 0);
  assert.equal(earnFor({ ...cfg, enabled: false }, 500000), 0);
});

test('đổi điểm bị giới hạn bởi số dư, % tiền hàng và mức tối thiểu', () => {
  // 30% của 200.000đ = 60.000đ = 300 điểm
  assert.deepEqual(redeemPlan(cfg, 1000, 200000, true), { max: 300, use: 300, amount: 60000 });
  assert.deepEqual(redeemPlan(cfg, 120, 200000, true), { max: 120, use: 120, amount: 24000 });
  assert.equal(redeemPlan(cfg, 5, 200000, true).use, 0);          // dưới mức tối thiểu
  assert.equal(redeemPlan(cfg, 1000, 200000, 50).use, 50);        // dùng một phần
  assert.equal(redeemPlan(cfg, 1000, 200000, 5).use, 0);          // một phần nhưng dưới tối thiểu
  assert.equal(redeemPlan(cfg, 1000, 200000, false).use, 0);
  assert.equal(redeemPlan({ ...cfg, enabled: false }, 1000, 200000, true).use, 0);
});
