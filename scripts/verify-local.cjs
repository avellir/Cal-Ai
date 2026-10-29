/* global __dirname */
const { execFileSync, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, '.cleanup-backups', 'local-checks', 'latest.json');
const outputDirectory = path.dirname(reportPath);
const logPath = name => path.join(outputDirectory, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.log');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const binary = (packageName, relativePath) => path.join(path.dirname(require.resolve(packageName + '/package.json')), relativePath);

function checkPlan(base) {
  return [
    { name: 'TypeScript', required: true, args: [binary('typescript', 'bin/tsc'), '--noEmit'] },
    { name: 'Jest', required: true, args: [binary('jest', 'bin/jest.js'), '--runInBand', '--json', '--outputFile', path.join(outputDirectory, 'jest-results.json')] },
    { name: 'Changed-file lint', required: true, args: [path.join(root, 'scripts/lint-changed.mjs'), base] },
    { name: 'Full app lint audit', required: false, args: [binary('eslint', 'bin/eslint.js'), 'app', 'components', '--format', 'json', '--output-file', path.join(outputDirectory, 'full-lint.json')] },
    { name: 'iOS JavaScript/assets export', required: true, args: [binary('expo', 'bin/cli'), 'export', '--platform', 'ios', '--output-dir', 'dist/local-verification-ios'] },
  ];
}

function execute(args, name) {
  return new Promise(resolve => {
    mkdirSync(outputDirectory, { recursive: true });
    const output = openSync(logPath(name), 'w');
    let finished = false;
    const finish = code => {
      if (finished) return;
      finished = true;
      closeSync(output);
      resolve(code);
    };
    const child = spawn(process.execPath, args, {
      cwd: root, stdio: ['ignore', output, output],
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' },
    });
    child.once('error', () => finish(1));
    child.once('exit', code => finish(code ?? 1));
  });
}

async function runChecks(checks, executor = execute, log = console.log) {
  const results = [];
  for (const check of checks) {
    log(`\nRunning ${check.name}${check.required ? '' : ' (audit)'}...`);
    const started = Date.now();
    let exitCode;
    try { exitCode = await executor(check.args, check.name); } catch { exitCode = 1; }
    const status = exitCode === 0 ? 'passed' : check.required ? 'failed' : 'audit_failed';
    results.push({ name: check.name, required: check.required, status, exitCode, durationMs: Date.now() - started,
      logFile: path.relative(root, logPath(check.name)) });
    log(`${check.name}: ${status}`);
  }
  return { success: results.every(result => !result.required || result.status === 'passed'), checks: results };
}

function sourceFingerprint() {
  const tracked = git(['ls-files', '-z']).split('\0');
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0');
  const hash = createHash('sha256');
  // Include changed source/configuration, including uncommitted files. Reports,
  // credentials, dependencies and generated output are outside this file list.
  for (const file of [...new Set([...tracked, ...untracked])].filter(file => /\.(?:[cm]?js|jsx|tsx?|json|ya?ml)$/.test(file)).sort()) {
    hash.update(file + '\0');
    hash.update(existsSync(path.join(root, file)) ? readFileSync(path.join(root, file)) : '<deleted>');
  }
  return hash.digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--base' || !args[1] || args[1].startsWith('-'))) {
    throw new Error('Usage: npm run verify -- [--base <ref-or-sha>]');
  }
  const base = args[1] || 'origin/main';
  git(['merge-base', base, 'HEAD']);
  for (const name of ['jest-results.json', 'full-lint.json']) {
    const file = path.join(outputDirectory, name);
    if (existsSync(file)) unlinkSync(file);
  }
  const fingerprint = sourceFingerprint();
  const context = { startedAt: new Date().toISOString(), branch: git(['branch', '--show-current']),
    commit: git(['rev-parse', 'HEAD']), base, sourceFingerprint: fingerprint,
    hasUncommittedChanges: Boolean(git(['status', '--porcelain'])) };
  const result = await runChecks(checkPlan(base));
  const sourceChangedDuringRun = fingerprint !== sourceFingerprint();
  const report = { ...context, ...result, success: result.success && !sourceChangedDuringRun,
    sourceChangedDuringRun, finishedAt: new Date().toISOString() };
  try {
    const tests = JSON.parse(readFileSync(path.join(outputDirectory, 'jest-results.json'), 'utf8'));
    report.tests = { passed: tests.numPassedTests, total: tests.numTotalTests, failedSuites: tests.numFailedTestSuites, passedSuites: tests.numPassedTestSuites };
  } catch { /* Failed launches may not produce a result file. */ }
  try {
    const lint = JSON.parse(readFileSync(path.join(outputDirectory, 'full-lint.json'), 'utf8'));
    report.lintAudit = { errors: lint.reduce((sum, file) => sum + file.errorCount, 0), warnings: lint.reduce((sum, file) => sum + file.warningCount, 0) };
  } catch { /* Failed launches may not produce a result file. */ }
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log('\nLocal verification summary:');
  for (const check of report.checks) console.log(`- ${check.name}: ${check.status}`);
  if (report.tests) console.log(`Tests: ${report.tests.passed}/${report.tests.total}; failed suites: ${report.tests.failedSuites}`);
  if (report.lintAudit) console.log(`Full-lint audit: ${report.lintAudit.errors} errors, ${report.lintAudit.warnings} warnings`);
  if (sourceChangedDuringRun) console.log('Source changed during verification; the report is not valid for the final state.');
  console.log(`Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.success ? 0 : 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error('Local verification could not complete: ' + error.message);
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ success: false, error: error.message, finishedAt: new Date().toISOString() }, null, 2) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { checkPlan, runChecks };
