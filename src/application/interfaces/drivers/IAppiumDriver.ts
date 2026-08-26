import { AppiumSession } from '../../../core/entities/AppiumSession';
import { CreateSessionOptions } from '../../dto/CreateSessionOptions';

/**
 * Platform-agnostic Appium session wrapper. The rest of the framework depends only on this
 * interface; AndroidAppiumDriver is one implementation, and a future IOSAppiumDriver
 * implementing this same contract is all that's needed to add iOS support.
 */
export interface IAppiumDriver {
  createSession(options: CreateSessionOptions): Promise<AppiumSession>;
  destroySession(): Promise<void>;
  isSessionActive(): boolean;
  getSession(): AppiumSession | null;
  launchApp(appId: string): Promise<void>;
  closeApp(appId: string): Promise<void>;
  /** Discards any dead session and re-creates one using the last-used session options. */
  recoverSession(): Promise<AppiumSession>;
}
