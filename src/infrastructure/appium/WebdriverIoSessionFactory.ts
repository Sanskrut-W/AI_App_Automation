import { remote } from 'webdriverio';
import type { Capabilities } from '@wdio/types';
import { IWebdriverSessionFactory, RemoteConnectionOptions } from './IWebdriverSessionFactory';
import { IAppiumSessionHandle } from './IAppiumSessionHandle';

/** Concrete IWebdriverSessionFactory backed by the real webdriverio client. */
export class WebdriverIoSessionFactory implements IWebdriverSessionFactory {
  async createRemote(
    connectionOptions: RemoteConnectionOptions,
    capabilities: Record<string, unknown>,
  ): Promise<IAppiumSessionHandle> {
    const browser = await remote({
      hostname: connectionOptions.hostname,
      port: connectionOptions.port,
      path: connectionOptions.path,
      protocol: connectionOptions.protocol,
      capabilities: capabilities as Capabilities.RequestedStandaloneCapabilities,
    });

    // Most members of WebdriverIO.Browser satisfy IAppiumSessionHandle structurally (plain
    // Promise-returning methods), but `$()` returns a ChainablePromiseElement, not a plain
    // Promise, so `findElement` needs an explicit adapter via `.getElement()`.
    return {
      sessionId: browser.sessionId,
      deleteSession: (...args) => browser.deleteSession(...args),
      activateApp: (...args) => browser.activateApp(...args),
      terminateApp: (...args) => browser.terminateApp(...args),
      takeScreenshot: (...args) => browser.takeScreenshot(...args),
      getPageSource: (...args) => browser.getPageSource(...args),
      getCurrentActivity: (...args) => browser.getCurrentActivity(...args),
      getCurrentPackage: (...args) => browser.getCurrentPackage(...args),
      getWindowSize: (...args) => browser.getWindowSize(...args),
      executeScript: (script: string, args?: Record<string, unknown>) =>
        browser.execute(script, args),
      elementExists: (selector: string) => browser.$(selector).isExisting(),
      back: (...args) => browser.back(...args),
      findElement: async (selector: string) => {
        const element = await browser.$(selector).getElement();
        return {
          click: (...args: Parameters<typeof element.click>) => element.click(...args),
          getText: (...args: Parameters<typeof element.getText>) => element.getText(...args),
          setValue: (value: string) => element.setValue(value),
          clearValue: (...args: Parameters<typeof element.clearValue>) =>
            element.clearValue(...args),
        };
      },
    };
  }
}
