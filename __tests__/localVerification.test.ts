// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkPlan, runChecks } = require('../scripts/verify-local.cjs');

it('runs every check and fails verification if a required check fails', async () => {
  const execute = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  const result = await runChecks([
    { name: 'TypeScript', required: true, args: ['typecheck'] },
    { name: 'Tests', required: true, args: ['tests'] },
  ], execute, () => undefined);
  expect(result.success).toBe(false);
  expect(result.checks.map((check: { status: string }) => check.status)).toEqual(['failed', 'passed']);
  expect(execute.mock.calls.map(call => call[0])).toEqual([['typecheck'], ['tests']]);
});

it('records known full-lint debt explicitly without claiming that audit passed', async () => {
  const result = await runChecks([
    { name: 'Tests', required: true, args: [] },
    { name: 'Full lint audit', required: false, args: [] },
  ], jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1), () => undefined);
  expect(result.success).toBe(true);
  expect(result.checks[1]).toEqual(expect.objectContaining({ status: 'audit_failed', exitCode: 1 }));
});

it('treats a failed process launch as a failure and continues collecting evidence', async () => {
  const result = await runChecks([
    { name: 'Tests', required: true, args: [] },
    { name: 'Export', required: true, args: [] },
  ], jest.fn().mockRejectedValueOnce(new Error('Process unavailable')).mockResolvedValueOnce(0), () => undefined);
  expect(result.success).toBe(false);
  expect(result.checks[1].status).toBe('passed');
});

it('checks the requested base, tests and bundle with no live provider operation', () => {
  const plan = checkPlan('origin/main');
  expect(plan.map((check: { name: string }) => check.name)).toEqual([
    'TypeScript', 'Jest', 'Changed-file lint', 'Full app lint audit', 'iOS JavaScript/assets export',
  ]);
  expect(plan[2].args.at(-1)).toBe('origin/main');
  expect(plan[4].args).toEqual(expect.arrayContaining(['export', '--platform', 'ios']));
  expect(plan.some((check: { args: string[] }) => check.args.some(arg => /check-nutrition|evaluate-food|deploy/.test(arg)))).toBe(false);
});
