// Copies the question JSON files into public/data; both folders are committed and deployed.
// Re-run after editing the bank, then commit, so the next deploy picks the change up.
// public/data/official/ holds only the ISTQB/ASTQB sample exams; public/data/sources/ holds the full bank.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const from = resolve(process.argv[2] ?? join(root, '..', 'ISTQB performance testing'));
const OFFICIAL = /^(istqb|astqb)-official-/;

if (!existsSync(from)) {
  console.error(`Question folder not found: ${from}\nPass it explicitly: npm run sync-data -- "<folder>"`);
  process.exit(1);
}

const files = readdirSync(from).filter((f) => f.endsWith('.json')).sort();
const folders = readdirSync(from, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

function copySet(target, names) {
  const dir = join(root, 'public', 'data', target);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const f of names) cpSync(join(from, f), join(dir, f));
  // Image folders sit next to the files that reference them by relative path.
  for (const d of folders) cpSync(join(from, d), join(dir, d), { recursive: true });
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ files: names }, null, 2));
  console.log(`${target}: ${names.length} file(s) -> public/data/${target}/`);
}

copySet('sources', files);
copySet('official', files.filter((f) => OFFICIAL.test(f)));
