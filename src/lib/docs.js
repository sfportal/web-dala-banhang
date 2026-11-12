// Tài liệu hệ thống (docs/tai-lieu-he-thong.md) công khai qua link nhưng cần mật mã.
// Người xem nhập mật mã ở /tai-lieu (lưu cookie); chatbot / hệ thống khác gửi mật mã qua
// ?key=, header X-Docs-Key hoặc Authorization: Bearer. Mật mã lưu dạng băm PBKDF2.
import DOC from '../../docs/tai-lieu-he-thong.md?raw';
import { getSetting } from './db.js';
import { esc, getCookie, hmacSha256, verifyPassword } from './util.js';

export const DOCS_MD = DOC;
const COOKIE = 'dala_docs';
const passHash = (env) => getSetting(env, 'secret:docs_pass_hash', null);
const cookieValue = (hash) => hmacSha256(hash, 'dala-docs-v1');

// Trả { ok, cookie? }: cookie chỉ đặt khi mật mã vừa nhập đúng
export async function docsAccess(env, request, url, formKey) {
  const hash = await passHash(env);
  if (!hash) return { ok: false, disabled: true };
  const c = getCookie(request, COOKIE);
  if (c && c === (await cookieValue(hash))) return { ok: true };
  const auth = request.headers.get('authorization') || '';
  const key = formKey ?? url.searchParams.get('key') ?? request.headers.get('x-docs-key') ?? (auth.startsWith('Bearer ') ? auth.slice(7) : null);
  if (!key) return { ok: false };
  if (!(await verifyPassword(String(key).trim(), hash))) return { ok: false, wrong: true };
  return { ok: true, cookie: `${COOKIE}=${await cookieValue(hash)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` };
}

// Markdown tối giản: tiêu đề, đoạn, danh sách, bảng, **đậm**, `code`, [link](url)
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}
export function mdToHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let list = null, para = [], toc = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`</${list}>`); list = null; }
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if (!l.trim()) { flush(); continue; }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      flush();
      const n = m[1].length, id = 'm-' + (toc.length + 1);
      if (n === 2) toc.push({ id, t: m[2] });
      out.push(`<h${n}${n === 2 ? ` id="${id}"` : ''}>${inline(m[2])}</h${n}>`);
      continue;
    }
    if (l.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
      const body = rows.filter((r, k) => k !== 1 || !/^\|[\s:|-]+\|$/.test(r));
      out.push('<div class="tbl"><table><thead><tr>' + cells(body[0]).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
        + body.slice(1).map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if ((m = l.match(/^(\s*)(-|\d+\.)\s+(.*)$/))) {
      if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
      const tag = m[2] === '-' ? 'ul' : 'ol';
      if (list !== tag) { if (list) out.push(`</${list}>`); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline(m[3])}</li>`);
      continue;
    }
    if (list) { out.push(`</${list}>`); list = null; }
    para.push(l.trim());
  }
  flush();
  return { html: out.join('\n'), toc };
}
