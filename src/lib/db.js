// Truy cập D1 + cài đặt (settings) dạng JSON
import { parseJson } from './util.js';

export const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results || [];
export const first = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
export const run = (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();
export const stmt = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);

// Khoá bí mật lưu trong settings với tiền tố "secret:", không bao giờ trả ra trình duyệt
export const SECRET_KEYS = ['secret:thuchi_api_key'];

export async function getSettings(env) {
  const rows = await all(env, "SELECT key, value FROM settings WHERE key NOT LIKE 'secret:%'");
  const out = {};
  for (const r of rows) out[r.key] = parseJson(r.value, r.value);
  return out;
}
export async function getSetting(env, key, fallback = null) {
  const r = await first(env, 'SELECT value FROM settings WHERE key=?', key);
  return r ? parseJson(r.value, r.value) : fallback;
}
export async function setSetting(env, key, value) {
  await run(env, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key,
    typeof value === 'string' ? value : JSON.stringify(value));
}
export async function getSecret(env, key, envName) {
  const v = await getSetting(env, 'secret:' + key, null);
  return v || (envName && env[envName]) || null;
}
