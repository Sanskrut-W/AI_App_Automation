import { CommandResult, ICommandRunner } from '../../shared/process/ICommandRunner';
import { ILogger } from '../../shared/logger/ILogger';

/** Thin, shared wrapper around the adb CLI so device- and app-level adapters don't duplicate invocation logic. */
export class AdbClient {
  constructor(
    private readonly commandRunner: ICommandRunner,
    private readonly logger: ILogger,
    private readonly adbPath: string = 'adb',
  ) {}

  /** Runs "adb -s <deviceId> <args>". */
  async run(deviceId: string, args: string[]): Promise<CommandResult> {
    return this.exec(['-s', deviceId, ...args]);
  }

  /** Runs adb without targeting a specific device (e.g. "adb devices"). */
  async runGlobal(args: string[]): Promise<CommandResult> {
    return this.exec(args);
  }

  private async exec(args: string[]): Promise<CommandResult> {
    this.logger.debug('Running adb command', { adbPath: this.adbPath, args });
    const result = await this.commandRunner.run(this.adbPath, args);
    this.logger.debug('adb command completed', {
      args,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
    return result;
  }
}
