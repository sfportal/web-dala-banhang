import { env } from 'cloudflare:workers';
import { all } from '../lib/db.js';
export async function GET({ url }) {
  const site = (env.SITE_URL || url.origin).replace(/\/$/, '');
  const products = await all(env, 'SELECT slug FROM products WHERE active=1');
  const posts = await all(env, 'SELECT slug, created_at FROM posts WHERE published=1');
  const urls = [['/', '1.0', 'daily'], ['/san-pham', '0.9', 'daily'], ['/san-pham?loai=combo', '0.8', 'weekly'], ['/flash-sale', '0.8', 'daily'], ['/cau-chuyen', '0.6', 'monthly'],
    ['/truy-xuat', '0.5', 'monthly'], ['/ctv', '0.7', 'monthly'], ['/blog', '0.6', 'weekly'], ['/lien-he', '0.4', 'yearly'], ['/chinh-sach', '0.3', 'yearly'],
    ...products.map((p) => [`/san-pham/${p.slug}`, '0.9', 'weekly']), ...posts.map((p) => [`/blog/${p.slug}`, '0.6', 'monthly'])];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr, f]) => `  <url><loc>${site}${u.replace(/&/g, '&amp;')}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
