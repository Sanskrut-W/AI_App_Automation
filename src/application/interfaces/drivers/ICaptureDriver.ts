/**
 * Read-only screen-state commands (screenshot, XML source, foreground package/activity).
 * Deliberately excludes interaction commands (tap/swipe/sendKeys/back) — those belong to the
 * exploration/crawler module, which does not exist yet.
 */
export interface ICaptureDriver {
  takeScreenshot(): Promise<Buffer>;
  getPageSource(): Promise<string>;
  getCurrentPackage(): Promise<string>;
  getCurrentActivity(): Promise<string>;
}
