import { IAppDriver } from '../../application/interfaces/drivers/IAppDriver';
import { CommandResult, ICommandRunner } from '../../shared/process/ICommandRunner';
import { ILogger } from '../../shared/logger/ILogger';
import { AdbCommandError } from './AdbCommandError';

const FAILURE_PATTERN = /failure\s*\[/i;

/** IAppDriver implementation backed by the Android Debug Bridge (adb) CLI. */
export class AdbAppDriver implements IAppDriver {
  constructor(
    private readonly commandRunner: ICommandRunner,
    private readonly logger: ILogger,
    private readonly adbPath: string = 'adb',
  ) {}

  async install(deviceId: string, apkPath: string): Promise<void> {
    const result = await this.runAdb(deviceId, ['install', '-r', apkPath]);
    if (this.isFailure(result)) {
      throw new AdbCommandError('install', result);
    }
  }

  async uninstall(deviceId: string, packageName: string): Promise<void> {
    const result = await this.runAdb(deviceId, ['uninstall', packageName]);
    if (this.isFailure(result)) {
      throw new AdbCommandError('uninstall', result);
    }
  }

  async launch(deviceId: string, packageName: string, activity?: string | null): Promise<void> {
    const args = activity
      ? ['shell', 'am', 'start', '-n', `${packageName}/${activity}`]
      : ['shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1'];

    const result = await this.runAdb(deviceId, args);
    if (this.isFailure(result)) {
      throw new AdbCommandError('launch', result);
    }
  }

  async terminate(deviceId: string, packageName: string): Promise<void> {
    const result = await this.runAdb(deviceId, ['shell', 'am', 'force-stop', packageName]);
    if (this.isFailure(result)) {
      throw new AdbCommandError('terminate', result);
    }
  }

  async isInstalled(deviceId: string, packageName: string): Promise<boolean> {
    const result = await this.runAdb(deviceId, ['shell', 'pm', 'list', 'packages', packageName]);
    if (result.exitCode !== 0) {
      throw new AdbCommandError('isInstalled', result);
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .includes(`package:${packageName}`);
  }

  private async runAdb(deviceId: string, args: string[]): Promise<CommandResult> {
    const fullArgs = ['-s', deviceId, ...args];
    this.logger.debug('Running adb command', { adbPath: this.adbPath, args: fullArgs });

    const result = await this.commandRunner.run(this.adbPath, fullArgs);

    this.logger.debug('adb command completed', {
      args: fullArgs,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
    return result;
  }

  private isFailure(result: CommandResult): boolean {
    return (
      result.exitCode !== 0 ||
      FAILURE_PATTERN.test(result.stdout) ||
      FAILURE_PATTERN.test(result.stderr)
    );
  }
}
