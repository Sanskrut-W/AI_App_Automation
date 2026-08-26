import { AppiumSession } from '../../core/entities/AppiumSession';
import { Platform } from '../../core/enums/Platform';
import { SessionCreationError } from '../../core/errors/SessionCreationError';
import { SessionDestructionError } from '../../core/errors/SessionDestructionError';
import { AppLaunchError } from '../../core/errors/AppLaunchError';
import { AppCloseError } from '../../core/errors/AppCloseError';
import { SessionRecoveryError } from '../../core/errors/SessionRecoveryError';
import { SessionNotActiveError } from '../../core/errors/SessionNotActiveError';
import { ScreenCaptureError } from '../../core/errors/ScreenCaptureError';
import { TapError } from '../../core/errors/TapError';
import { NavigationError } from '../../core/errors/NavigationError';
import { SendKeysError } from '../../core/errors/SendKeysError';
import { ScrollError } from '../../core/errors/ScrollError';
import { SwipeError } from '../../core/errors/SwipeError';
import { GetTextError } from '../../core/errors/GetTextError';
import { ElementExistsCheckError } from '../../core/errors/ElementExistsCheckError';
import { ElementLocator } from '../../core/value-objects/ElementLocator';
import { LocatorStrategy } from '../../core/enums/LocatorStrategy';
import { ScrollDirection } from '../../core/enums/ScrollDirection';
import { IAppiumDriver } from '../../application/interfaces/drivers/IAppiumDriver';
import { ICaptureDriver } from '../../application/interfaces/drivers/ICaptureDriver';
import { IInteractionDriver } from '../../application/interfaces/drivers/IInteractionDriver';
import { ICapabilitiesBuilder } from '../../application/interfaces/appium/ICapabilitiesBuilder';
import { CreateSessionOptions } from '../../application/dto/CreateSessionOptions';
import { ILogger } from '../../shared/logger/ILogger';
import { IWebdriverSessionFactory, RemoteConnectionOptions } from './IWebdriverSessionFactory';
import { IAppiumSessionHandle } from './IAppiumSessionHandle';

const DEFAULT_CONNECTION: RemoteConnectionOptions = {
  hostname: 'localhost',
  port: 4723,
  path: '/',
  protocol: 'http',
};

/** IAppiumDriver + ICaptureDriver + IInteractionDriver implementation for Android/UiAutomator2. Adding iOS support means writing an IOSAppiumDriver that implements the same interfaces — nothing here is reused by inheritance. */
export class AndroidAppiumDriver implements IAppiumDriver, ICaptureDriver, IInteractionDriver {
  private handle: IAppiumSessionHandle | null = null;
  private lastOptions: CreateSessionOptions | null = null;

  constructor(
    private readonly sessionFactory: IWebdriverSessionFactory,
    private readonly capabilitiesBuilder: ICapabilitiesBuilder,
    private readonly logger: ILogger,
    private readonly connectionOptions: RemoteConnectionOptions = DEFAULT_CONNECTION,
  ) {}

  async createSession(options: CreateSessionOptions): Promise<AppiumSession> {
    this.logger.info('Creating Appium session', {
      deviceId: options.deviceId,
      appPackage: options.appPackage,
    });

    const capabilities = this.capabilitiesBuilder.build(options);

    try {
      const handle = await this.sessionFactory.createRemote(this.connectionOptions, capabilities);
      this.handle = handle;
      this.lastOptions = options;

      const session = new AppiumSession({
        sessionId: handle.sessionId,
        deviceId: options.deviceId,
        platform: Platform.ANDROID,
      });

      this.logger.info('Appium session created', {
        sessionId: session.sessionId,
        deviceId: options.deviceId,
      });
      return session;
    } catch (error) {
      this.handle = null;
      throw new SessionCreationError(
        `Failed to create Appium session for device "${options.deviceId}": ${this.describe(error)}`,
      );
    }
  }

  async destroySession(): Promise<void> {
    if (!this.handle) {
      this.logger.debug('destroySession() called with no active session — nothing to do');
      return;
    }

    const { sessionId } = this.handle;
    this.logger.info('Destroying Appium session', { sessionId });

    try {
      await this.handle.deleteSession();
      this.logger.info('Appium session destroyed', { sessionId });
    } catch (error) {
      throw new SessionDestructionError(
        `Failed to destroy Appium session: ${this.describe(error)}`,
      );
    } finally {
      this.handle = null;
    }
  }

  isSessionActive(): boolean {
    return this.handle !== null;
  }

  getSession(): AppiumSession | null {
    if (!this.handle || !this.lastOptions) {
      return null;
    }
    return new AppiumSession({
      sessionId: this.handle.sessionId,
      deviceId: this.lastOptions.deviceId,
      platform: Platform.ANDROID,
    });
  }

  async launchApp(appId: string): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Launching app', { appId });
    try {
      await handle.activateApp(appId);
      this.logger.info('App launched', { appId });
    } catch (error) {
      throw new AppLaunchError(`Failed to launch app "${appId}": ${this.describe(error)}`);
    }
  }

  async closeApp(appId: string): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Closing app', { appId });
    try {
      await handle.terminateApp(appId);
      this.logger.info('App closed', { appId });
    } catch (error) {
      throw new AppCloseError(`Failed to close app "${appId}": ${this.describe(error)}`);
    }
  }

  async takeScreenshot(): Promise<Buffer> {
    const handle = this.requireActiveSession();
    try {
      const base64 = await handle.takeScreenshot();
      return Buffer.from(base64, 'base64');
    } catch (error) {
      throw new ScreenCaptureError(`Failed to capture screenshot: ${this.describe(error)}`);
    }
  }

  async getPageSource(): Promise<string> {
    const handle = this.requireActiveSession();
    try {
      return await handle.getPageSource();
    } catch (error) {
      throw new ScreenCaptureError(`Failed to capture page source: ${this.describe(error)}`);
    }
  }

  async getCurrentPackage(): Promise<string> {
    const handle = this.requireActiveSession();
    try {
      return await handle.getCurrentPackage();
    } catch (error) {
      throw new ScreenCaptureError(`Failed to read current package: ${this.describe(error)}`);
    }
  }

  async getCurrentActivity(): Promise<string> {
    const handle = this.requireActiveSession();
    try {
      return await handle.getCurrentActivity();
    } catch (error) {
      throw new ScreenCaptureError(`Failed to read current activity: ${this.describe(error)}`);
    }
  }

  async tap(locator: ElementLocator): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Tapping element', { strategy: locator.strategy, value: locator.value });
    try {
      if (locator.strategy === LocatorStrategy.COORDINATES) {
        const { x, y } = this.parseCoordinates(locator.value);
        await handle.executeScript('mobile: clickGesture', { x, y });
      } else {
        const element = await handle.findElement(this.toSelector(locator));
        await element.click();
      }
      this.logger.info('Element tapped', { strategy: locator.strategy, value: locator.value });
    } catch (error) {
      throw new TapError(
        `Failed to tap element (${locator.strategy}="${locator.value}"): ${this.describe(error)}`,
      );
    }
  }

  async back(): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Navigating back');
    try {
      await handle.back();
      this.logger.info('Navigated back');
    } catch (error) {
      throw new NavigationError(`Failed to navigate back: ${this.describe(error)}`);
    }
  }

  async sendKeys(locator: ElementLocator, value: string): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Typing into element', { strategy: locator.strategy, value: locator.value });
    try {
      if (locator.strategy === LocatorStrategy.COORDINATES) {
        // Mirrors tap()'s coordinate fallback: a WebView-hosted field's resource-id can be an
        // ephemeral id the accessibility tree assigns fresh per page load (not a stable Android
        // view id), so tree-based lookup can fail even though the field is visibly right there.
        // Tapping the captured position focuses it, then "mobile: type" sends keystrokes to
        // whatever now has focus — no element lookup involved at all.
        const { x, y } = this.parseCoordinates(locator.value);
        await handle.executeScript('mobile: clickGesture', { x, y });
        await handle.executeScript('mobile: type', { text: value });
      } else {
        const element = await handle.findElement(this.toSelector(locator));
        await element.setValue(value);
      }
      this.logger.info('Typed into element', { strategy: locator.strategy, value: locator.value });
    } catch (error) {
      throw new SendKeysError(
        `Failed to type into element (${locator.strategy}="${locator.value}"): ${this.describe(error)}`,
      );
    }
  }

  async getText(locator: ElementLocator): Promise<string> {
    const handle = this.requireActiveSession();
    this.logger.info('Reading element text', { strategy: locator.strategy, value: locator.value });
    try {
      const element = await handle.findElement(this.toSelector(locator));
      return await element.getText();
    } catch (error) {
      throw new GetTextError(
        `Failed to read text from element (${locator.strategy}="${locator.value}"): ${this.describe(error)}`,
      );
    }
  }

  async elementExists(locator: ElementLocator): Promise<boolean> {
    const handle = this.requireActiveSession();
    // A raw coordinate can't be looked up in the accessibility tree — the whole point of this
    // last-resort locator is that tree-based lookup was unreliable. Trust the position captured
    // at crawl/generation time and treat existence as satisfied so the CLICK step can still run.
    if (locator.strategy === LocatorStrategy.COORDINATES) {
      return true;
    }
    try {
      return await handle.elementExists(this.toSelector(locator));
    } catch (error) {
      throw new ElementExistsCheckError(
        `Failed to check existence of element (${locator.strategy}="${locator.value}"): ${this.describe(error)}`,
      );
    }
  }

  async scroll(direction: ScrollDirection): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Scrolling screen', { direction });
    try {
      const { width, height } = await handle.getWindowSize();
      await handle.executeScript('mobile: scrollGesture', {
        left: Math.round(width * 0.1),
        top: Math.round(height * 0.1),
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.8),
        direction,
        percent: 0.75,
      });
      this.logger.info('Scrolled screen', { direction });
    } catch (error) {
      throw new ScrollError(`Failed to scroll ${direction}: ${this.describe(error)}`);
    }
  }

  /**
   * Raw two-point drag, bypassing "mobile: scrollGesture"'s scrollable-widget auto-detection
   * entirely — proven necessary live against a nested ExpandableListView (a navigation drawer)
   * where scrollGesture silently no-ops (before/after page source byte-identical) because it
   * can't resolve the right scrollable widget from a bounding box. "mobile: dragGesture" with the
   * exact same start/end coordinates moves the list correctly.
   */
  async swipe(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    const handle = this.requireActiveSession();
    this.logger.info('Swiping screen', { fromX, fromY, toX, toY });
    try {
      await handle.executeScript('mobile: dragGesture', {
        startX: fromX,
        startY: fromY,
        endX: toX,
        endY: toY,
        speed: 1000,
      });
      this.logger.info('Swiped screen', { fromX, fromY, toX, toY });
    } catch (error) {
      throw new SwipeError(
        `Failed to swipe from (${fromX},${fromY}) to (${toX},${toY}): ${this.describe(error)}`,
      );
    }
  }

  /** Maps a locator to the webdriverio "<strategy>:<value>" direct-selector syntax (xpath values pass through as-is). */
  private toSelector(locator: ElementLocator): string {
    switch (locator.strategy) {
      case LocatorStrategy.RESOURCE_ID:
        return `id:${locator.value}`;
      case LocatorStrategy.ACCESSIBILITY_ID:
        return `accessibility id:${locator.value}`;
      case LocatorStrategy.XPATH_TEXT:
      case LocatorStrategy.XPATH_CLASS_INDEX:
        return locator.value;
      case LocatorStrategy.ANDROID_UIAUTOMATOR:
        return `android=${locator.value}`;
      default:
        throw new Error(`Unsupported locator strategy: ${String(locator.strategy)}`);
    }
  }

  /** Parses a "x,y" COORDINATES locator value, as produced by XmlElementParser from an element's bounds center. */
  private parseCoordinates(value: string): { x: number; y: number } {
    const [xRaw, yRaw] = value.split(',');
    const x = Number(xRaw);
    const y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Invalid coordinates locator value: "${value}"`);
    }
    return { x, y };
  }

  async recoverSession(): Promise<AppiumSession> {
    if (!this.lastOptions) {
      throw new SessionRecoveryError('Cannot recover a session: no session has been created yet.');
    }

    this.logger.warn('Recovering Appium session', { deviceId: this.lastOptions.deviceId });

    if (this.handle) {
      try {
        await this.handle.deleteSession();
      } catch (error) {
        this.logger.warn('Ignoring error while discarding the previous session during recovery', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      this.handle = null;
    }

    try {
      const session = await this.createSession(this.lastOptions);
      this.logger.info('Appium session recovered', { sessionId: session.sessionId });
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SessionRecoveryError(`Failed to recover Appium session: ${message}`);
    }
  }

  private requireActiveSession(): IAppiumSessionHandle {
    if (!this.handle) {
      throw new SessionNotActiveError('No active Appium session. Call createSession() first.');
    }
    return this.handle;
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying Appium/webdriverio error', error);
      return error.message;
    }
    return String(error);
  }
}
