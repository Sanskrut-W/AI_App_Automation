/** Narrow structural view of a single found element — tapping, reading text, and typing into it. */
export interface IAppiumElementHandle {
  click(): Promise<void>;
  getText(): Promise<string>;
  setValue(value: string): Promise<void>;
  /** Empties a text field. Preferred over typing an empty string, which is a no-op. */
  clearValue(): Promise<void>;
}

/**
 * Narrow structural view of a live WebdriverIO/Appium session — only what AndroidAppiumDriver
 * needs. Session-lifecycle and capture members are satisfied directly by a real
 * `WebdriverIO.Browser` (structural typing); `findElement` requires adapting, since webdriverio's
 * `$()` returns a `ChainablePromiseElement`, not a plain `Promise` (see WebdriverIoSessionFactory).
 * Tests can substitute a plain object with these members without touching a real Appium server.
 */
export interface IAppiumSessionHandle {
  readonly sessionId: string;
  deleteSession(): Promise<void>;
  activateApp(appId: string): Promise<void>;
  terminateApp(appId: string): Promise<void>;
  /** Returns a base64-encoded PNG, per the W3C WebDriver spec. */
  takeScreenshot(): Promise<string>;
  getPageSource(): Promise<string>;
  getCurrentActivity(): Promise<string>;
  getCurrentPackage(): Promise<string>;
  findElement(selector: string): Promise<IAppiumElementHandle>;
  /** Checks for element existence without throwing when the element is simply absent. */
  elementExists(selector: string): Promise<boolean>;
  getWindowSize(): Promise<{ width: number; height: number }>;
  /** Runs an Appium/WebDriver script command, e.g. a UiAutomator2 "mobile:" gesture command. */
  executeScript(script: string, args?: Record<string, unknown>): Promise<unknown>;
  back(): Promise<void>;
}
