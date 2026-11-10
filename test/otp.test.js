import test from 'node:test';
import assert from 'node:assert/strict';
import { _test } from '../src/lib/otp.js';

test('mã OTP luôn đủ 6 chữ số', () => {
  for (let i = 0; i < 500; i++) assert.match(_test.genCode(), /^\d{6}$/);
});

test('băm mã OTP gắn với số điện thoại và mục đích', async () => {
  const a = await _test.hashCode('0912000111', 'signup', '123456', 'abcd');
  assert.equal(a, await _test.hashCode('0912000111', 'signup', '123456', 'abcd'));
  assert.notEqual(a, await _test.hashCode('0912000112', 'signup', '123456', 'abcd'));
  assert.notEqual(a, await _test.hashCode('0912000111', 'reset', '123456', 'abcd'));
  assert.ok(a.startsWith('abcd$'));
});
