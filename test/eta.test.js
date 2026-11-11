import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLeadTime, estimateEta, pickupDate } from '../src/lib/eta.js';

test('đọc thời gian giao của hãng', () => {
  assert.deepEqual(parseLeadTime('Dự kiến 2–4 ngày'), [2, 4]);
  assert.deepEqual(parseLeadTime('1 - 2 ngày'), [1, 2]);
  assert.deepEqual(parseLeadTime('24 giờ'), [1, 1]);
  assert.deepEqual(parseLeadTime('Giao trong 48h'), [2, 2]);
  assert.equal(parseLeadTime('nhanh'), null);
});

test('ngày giao: trước giờ chốt gửi trong ngày, sau giờ chốt gửi hôm sau, bỏ Chủ nhật', () => {
  // T4 11/11/2026 13:00 giờ VN
  assert.equal(estimateEta('1-2 ngày', {}, Date.parse('2026-11-11T06:00:00Z')).text, 'T5 12/11 – T6 13/11');
  // T4 11/11 16:00 VN → gửi T5
  assert.equal(estimateEta('1 ngày', {}, Date.parse('2026-11-11T09:00:00Z')).from, '2026-11-13');
  // T7 14/11 17:00 VN → CN nghỉ → gửi T2 16/11
  assert.equal(pickupDate({}, Date.parse('2026-11-14T10:00:00Z')).toISOString().slice(0, 10), '2026-11-16');
  assert.equal(pickupDate({ pickup_sunday: true }, Date.parse('2026-11-14T10:00:00Z')).toISOString().slice(0, 10), '2026-11-15');
  // không đọc được → mặc định 2–4 ngày
  assert.deepEqual([estimateEta('', {}, Date.parse('2026-11-11T06:00:00Z')).from, estimateEta('', {}, Date.parse('2026-11-11T06:00:00Z')).to], ['2026-11-13', '2026-11-15']);
});
