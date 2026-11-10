import { env } from 'cloudflare:workers';
export function GET({ url }) {
  const site = (env.SITE_URL || url.origin).replace(/\/$/, '');
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /thanh-toan\nDisallow: /don-hang/\nDisallow: /lo/\n\nSitemap: ${site}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
