import { execFile } from 'child_process';
import { CommandResult, ICommandRunner } from '../../shared/process/ICommandRunner';

/** Runs commands via execFile (no shell), so args are never subject to shell interpolation/injection. */
export class NodeCommandRunner implements ICommandRunner {
  run(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve) => {
      execFile(command, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (!error) {
          resolve({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode: 0 });
          return;
        }

        const execError = error as NodeJS.ErrnoException & { code?: number | string };
        const exitCode = typeof execError.code === 'number' ? execError.code : -1;
        resolve({
          stdout: stdout?.toString() ?? '',
          stderr: stderr?.toString() || execError.message,
          exitCode,
        });
      });
    });
  }
}
