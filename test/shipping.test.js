import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildParcel, fallbackQuote, normalizeRate } from '../src/lib/shipping.js';

test('gộp kiện: cộng khối lượng + bao bì, thêm đệm khi có hàng dễ vỡ', () => {
  const p = buildParcel([{ qty: 2, weight_g: 400, length_cm: 12, width_cm: 12, height_cm: 15 }], { packaging_weight: 120 });
  assert.equal(p.weight, 920);
  assert.equal(p.fragile, false);
  const f = buildParcel([{ qty: 1, weight_g: 300, length_cm: 8, width_cm: 8, height_cm: 18, fragile: 1 }], { packaging_weight: 120, fragile_padding_cm: 2 });
  assert.equal(f.weight, 300 + 120 + 150);
  assert.equal(f.fragile, true);
  assert.ok(f.length >= 8 + 4 && f.height >= 4);
});

test('bảng phí dự phòng: theo khối lượng, tỉnh gần, phụ phí dễ vỡ', () => {
  const light = { weight: 450, length: 10, width: 10, height: 10, fragile: false };
  assert.equal(fallbackQuote(light, 'Hà Nội')[0].fee, 25000);
  assert.equal(fallbackQuote(light, 'Đắk Lắk')[0].fee, 20000);
  assert.equal(fallbackQuote({ ...light, fragile: true }, 'Hà Nội', { fragile_fee: 10000 })[0].fee, 35000);
  assert.equal(fallbackQuote({ weight: 2600, length: 10, width: 10, height: 10 }, 'Hà Nội')[0].fee, 38000 + 2 * 5000);
});

test('khối lượng quy đổi lớn hơn khối lượng thật thì tính theo quy đổi', () => {
  const bulky = { weight: 300, length: 30, width: 30, height: 30, fragile: false }; // 4.5kg quy đổi
  assert.ok(fallbackQuote(bulky, 'Hà Nội')[0].fee > 38000);
});

test('chuẩn hoá giá Goship', () => {
  const r = normalizeRate({ id: 'abc', carrier_name: 'GHN', total_fee: 30000, cod_fee: 5000, report: { success_percent: 97 } }, 10000);
  assert.equal(r.fee, 45000);
  assert.equal(r.carrier_fee, 35000);
  assert.equal(r.success, 97);
});
