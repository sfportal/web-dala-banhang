// Ghi thông tin bản dựng (phiên bản, số bản dựng, commit, thời điểm) để admin và /api/version hiển thị.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const git = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
const commit = process.env.GITHUB_SHA || git('git rev-parse HEAD');
const info = {
  version: pkg.version,
  build: process.env.GITHUB_RUN_NUMBER ? Number(process.env.GITHUB_RUN_NUMBER) : null,
  commit: commit ? commit.slice(0, 7) : null,
  commit_full: commit || null,
  commit_message: git('git log -1 --format=%s'),
  branch: process.env.GITHUB_REF_NAME || git('git rev-parse --abbrev-ref HEAD'),
  repo: process.env.GITHUB_REPOSITORY || 'sfportal/web-dala-banhang',
  built_at: new Date().toISOString(),
  env: process.env.GITHUB_ACTIONS ? 'production' : 'local',
};
mkdirSync(new URL('../src/generated/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/generated/build-info.json', import.meta.url), JSON.stringify(info, null, 2));
console.log(`build-info: v${info.version}${info.build ? ' #' + info.build : ''} ${info.commit || ''}`);
