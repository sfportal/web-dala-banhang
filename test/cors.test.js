import test from 'node:test';
import assert from 'node:assert/strict';
import { CORS_PATHS, corsOrigin, withCors } from '../src/lib/cors.js';

test('chỉ mở CORS cho tên miền Zalo Mini App và localhost', () => {
  assert.equal(corsOrigin('https://h5.zdn.vn'), 'https://h5.zdn.vn');
  assert.equal(corsOrigin('zbrowser://h5.zdn.vn'), 'zbrowser://h5.zdn.vn');
  assert.equal(corsOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(corsOrigin('https://evil.example'), null);
  assert.equal(corsOrigin('https://h5.zdn.vn.evil.example'), null);
  assert.equal(corsOrigin(null), null);
});

test('mini app gọi được API cửa hàng, đăng nhập Zalo, tài khoản và CTV; quản trị thì không', () => {
  for (const p of ['/api/catalog', '/api/cart/quote', '/api/checkout', '/api/orders/DL000123', '/api/geo/wards', '/api/zalo/login', '/api/zalo/location',
    '/api/account/me', '/api/account/affiliate', '/api/aff/me', '/api/aff/orders', '/api/aff/withdraw']) assert.ok(CORS_PATHS.test(p), p);
  for (const p of ['/api/admin/orders', '/api/admin/settings', '/api/account/login', '/api/account/register', '/api/aff/login', '/api/zalo/webhook', '/api/cron', '/api/t']) assert.ok(!CORS_PATHS.test(p), p);
});

test('gắn header CORS mà giữ nguyên nội dung và mã trạng thái', async () => {
  const r = withCors(new Response('{"a":1}', { status: 409, headers: { 'content-type': 'application/json' } }), 'https://h5.zdn.vn');
  assert.equal(r.status, 409);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://h5.zdn.vn');
  assert.equal(r.headers.get('content-type'), 'application/json');
  assert.equal(await r.text(), '{"a":1}');
});
