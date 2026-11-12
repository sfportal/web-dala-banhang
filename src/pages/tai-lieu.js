import { env } from 'cloudflare:workers';
import { docsAccess, mdToHtml, DOCS_MD } from '../lib/docs.js';
import { esc } from '../lib/util.js';

export const prerender = false;
const HEAD = { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };

const CSS = `*{box-sizing:border-box}body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2a1c;background:#f7f5ee}
a{color:#2f6b2a}code{background:#ecefe4;padding:1px 5px;border-radius:4px;font-size:.9em}
.wrap{max-width:980px;margin:0 auto;padding:28px 20px 80px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.top small{color:#6b7466}h1{font-size:1.9rem;line-height:1.25;margin:.2em 0 .6em}h2{font-size:1.4rem;margin:2em 0 .5em;padding-top:.6em;border-top:1px solid #e3e0d4}h3{font-size:1.1rem;margin:1.4em 0 .4em}
.toc{background:#fff;border:1px solid #e3e0d4;border-radius:12px;padding:12px 18px;margin:16px 0}.toc ol{margin:6px 0;padding-left:20px;columns:2}.toc li{margin:2px 0}
.tbl{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;width:100%;background:#fff;font-size:.94rem}th,td{border:1px solid #e3e0d4;padding:7px 10px;text-align:left;vertical-align:top}th{background:#eef1e6}
.gate{max-width:380px;margin:12vh auto;background:#fff;border:1px solid #e3e0d4;border-radius:16px;padding:28px}.gate h1{font-size:1.4rem}
input{width:100%;padding:11px 12px;border:1px solid #cfd3c4;border-radius:10px;font:inherit;margin:8px 0 12px}button{width:100%;padding:11px;border:0;border-radius:10px;background:#3f7a2f;color:#fff;font:600 1rem system-ui;cursor:pointer}
.err{color:#b3261e;font-size:.92rem}@media(max-width:640px){.toc ol{columns:1}}`;

function gate(msg, status = 200) {
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Tài liệu hệ thống DaLa</title><style>${CSS}</style></head><body><form class="gate" method="post" action="/tai-lieu">
<h1>Tài liệu hệ thống DaLa</h1><p>Nhập mật mã để xem.</p>${msg ? `<p class="err">${esc(msg)}</p>` : ''}
<input type="password" name="key" autocomplete="current-password" autofocus required placeholder="Mật mã"><button>Xem tài liệu</button></form></body></html>`, { status, headers: HEAD });
}

function page(cookie) {
  const { html, toc } = mdToHtml(DOCS_MD);
  const h = { ...HEAD };
  if (cookie) h['set-cookie'] = cookie;
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Tài liệu hệ thống DaLa</title><link rel="alternate" type="text/markdown" href="/tai-lieu.md"><style>${CSS}</style></head><body><main class="wrap">
<div class="top"><small>Bản Markdown cho máy đọc: <a href="/tai-lieu.md">/tai-lieu.md</a></small></div>
${html.replace(/(<\/h1>)/, `$1<nav class="toc"><b>Mục lục</b><ol>${toc.map((x) => `<li><a href="#${x.id}">${esc(x.t.replace(/^\d+\.\s*/, '').replace(/`/g, ''))}</a></li>`).join('')}</ol></nav>`)}
</main></body></html>`, { headers: h });
}

export async function GET({ request, url }) {
  const a = await docsAccess(env, request, url);
  if (a.disabled) return gate('Tài liệu chưa được bật mật mã.', 403);
  if (!a.ok) return gate(a.wrong ? 'Mật mã không đúng.' : '', a.wrong ? 401 : 200);
  return page(a.cookie);
}

export async function POST({ request, url }) {
  const f = await request.formData().catch(() => null);
  const a = await docsAccess(env, request, url, String(f?.get('key') || ''));
  if (!a.ok) return gate(a.disabled ? 'Tài liệu chưa được bật mật mã.' : 'Mật mã không đúng.', 401);
  return new Response(null, { status: 303, headers: { location: '/tai-lieu', 'set-cookie': a.cookie || '' } });
}
