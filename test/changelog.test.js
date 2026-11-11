import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseChangelog, changelogSection } from '../src/lib/changelog.js';

test('CHANGELOG có mục cho phiên bản trong package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const list = parseChangelog(md);
  assert.equal(list[0].version, pkg.version, 'mục mới nhất phải trùng version');
  assert.ok(changelogSection(md, pkg.version));
  assert.ok(list.every((x) => x.items.length > 0));
});
