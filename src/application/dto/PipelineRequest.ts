export interface PipelineRequest {
  apkPath: string;
  /** Use an already-running device/emulator with this adb serial. Mutually exclusive with avdName. */
  deviceId?: string;
  /** Boot this AVD first, then use whatever serial it comes up as. Mutually exclusive with deviceId. */
  avdName?: string;
  bootTimeoutMs?: number;
  /** Both must be given to generate a login test case (module "login"); if either is missing, login test case generation is skipped entirely. */
  loginMobileNumber?: string;
  loginPassword?: string;
  /** Crawl and generate test cases as usual, but skip the auto-execute-hamburger-menu-suite step
   * at the end — useful when the only goal of this run is discovery (e.g. capturing a new
   * module's screen for the first time), not re-running the existing suite. */
  crawlOnly?: boolean;
}
