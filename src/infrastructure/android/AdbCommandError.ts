import { CommandResult } from '../../shared/process/ICommandRunner';

/** Infra-level failure detail for a failed adb invocation. Converted to a domain Result at the use-case boundary. */
export class AdbCommandError extends Error {
  constructor(
    public readonly operation: string,
    public readonly result: CommandResult,
  ) {
    super(
      `adb ${operation} failed (exit ${result.exitCode}): ${(result.stderr || result.stdout).trim()}`,
    );
    this.name = 'AdbCommandError';
    Object.setPrototypeOf(this, AdbCommandError.prototype);
  }
}
