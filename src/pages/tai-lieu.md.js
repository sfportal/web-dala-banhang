import { env } from 'cloudflare:workers';
import { docsAccess, DOCS_MD } from '../lib/docs.js';

export const prerender = false;
export async function GET({ request, url }) {
  const a = await docsAccess(env, request, url);
  const h = { 'content-type': 'text/markdown; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'private, no-store' };
  if (!a.ok) return new Response('Cần mật mã: thêm ?key=<mật mã>, header X-Docs-Key hoặc Authorization: Bearer <mật mã>.\n', { status: 401, headers: { ...h, 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(DOCS_MD, { headers: h });
}
