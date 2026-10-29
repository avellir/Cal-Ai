import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ESLint } from 'eslint';

const base = process.argv[2];
if (!base || base.startsWith('-')) {
  throw new Error('Usage: node scripts/lint-changed.mjs <base-ref-or-sha>');
}
const gitFiles = args => execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
// Merge-base excludes unrelated changes that landed on main after branching.
const ancestor = execFileSync('git', ['merge-base', base, 'HEAD'], { encoding: 'utf8' }).trim();
const changed = [
  ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR', '-z', ancestor]),
  ...gitFiles(['ls-files', '--others', '--exclude-standard', '-z']),
];
const files = [...new Set(changed)].filter(file => /\.(?:[cm]?js|jsx|ts|tsx)$/.test(file) && existsSync(file));
const eslint = new ESLint();
const included = [];
for (const file of files) if (!await eslint.isPathIgnored(file)) included.push(file);
if (!included.length) {
  console.log('No changed JavaScript/TypeScript files to lint.');
} else {
  const results = await eslint.lintFiles(included);
  const formatter = await eslint.loadFormatter('stylish');
  const output = formatter.format(results);
  if (output) console.log(output);
  console.log(`Linted ${included.length} changed file(s).`);
  if (results.some(result => result.errorCount || result.fatalErrorCount)) process.exitCode = 1;
}
