import { NodeCommandRunner } from '../../../../src/infrastructure/process/NodeCommandRunner';

describe('NodeCommandRunner', () => {
  it('resolves with stdout and exitCode 0 for a successful command', async () => {
    const runner = new NodeCommandRunner();

    const result = await runner.run(process.execPath, ['-e', "process.stdout.write('hello')"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
  });

  it('resolves (does not throw/reject) with a non-zero exitCode when the command fails', async () => {
    const runner = new NodeCommandRunner();

    const result = await runner.run(process.execPath, ['-e', 'process.exit(3)']);

    expect(result.exitCode).toBe(3);
  });

  it('resolves with a negative exitCode when the executable cannot be found', async () => {
    const runner = new NodeCommandRunner();

    const result = await runner.run('this-binary-does-not-exist-anywhere', []);

    expect(result.exitCode).toBe(-1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
