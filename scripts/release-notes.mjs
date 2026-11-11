// In phần nhật ký của một phiên bản từ CHANGELOG.md (dùng cho bản phát hành GitHub và kiểm tra CI).
// node scripts/release-notes.mjs [phiên bản]   → mặc định lấy version trong package.json; thoát mã 1 nếu không có mục.
import { readFileSync } from 'node:fs';
import { changelogSection } from '../src/lib/changelog.js';

const v = process.argv[2] || JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
const notes = changelogSection(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), v);
if (!notes) { console.error(`CHANGELOG.md chưa có mục "## ${v}"`); process.exit(1); }
console.log(notes);
