// Đọc CHANGELOG.md: "## 1.4.0 – 11/11/2026" rồi các dòng "- ..."
export function parseChangelog(md) {
  const out = [];
  let cur = null;
  for (const line of String(md || '').split('\n')) {
    const h = line.match(/^##\s+(\d+\.\d+\.\d+)\s*(?:[–-]\s*(.+))?$/);
    if (h) { cur = { version: h[1], date: (h[2] || '').trim() || null, items: [] }; out.push(cur); continue; }
    const it = line.match(/^\s*[-*]\s+(.+)$/);
    if (cur && it) cur.items.push(it[1].trim());
  }
  return out;
}

export function changelogSection(md, version) {
  const r = parseChangelog(md).find((x) => x.version === version);
  return r && r.items.length ? r.items.map((i) => '- ' + i).join('\n') : null;
}
