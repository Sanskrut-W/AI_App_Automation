export interface IProcessLauncher {
  /** Spawns a long-running, detached process and returns immediately without waiting for exit. */
  launchDetached(command: string, args: string[]): void;
}
