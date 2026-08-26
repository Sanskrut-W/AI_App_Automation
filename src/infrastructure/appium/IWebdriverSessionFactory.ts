import { IAppiumSessionHandle } from './IAppiumSessionHandle';

export interface RemoteConnectionOptions {
  hostname: string;
  port: number;
  path: string;
  protocol: string;
}

/** Abstracts webdriverio's remote() call so AndroidAppiumDriver is testable without a live Appium server. */
export interface IWebdriverSessionFactory {
  createRemote(
    connectionOptions: RemoteConnectionOptions,
    capabilities: Record<string, unknown>,
  ): Promise<IAppiumSessionHandle>;
}
