export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Abstracts process execution so adapters (ADB, aapt, emulator control, ...) are mockable in tests. */
export interface ICommandRunner {
  run(command: string, args: string[]): Promise<CommandResult>;
}
