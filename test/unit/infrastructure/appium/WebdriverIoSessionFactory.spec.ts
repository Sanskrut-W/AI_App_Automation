const mockRemote = jest.fn();

jest.mock('webdriverio', () => ({
  remote: (...args: unknown[]) => mockRemote(...args),
}));

import { WebdriverIoSessionFactory } from '../../../../src/infrastructure/appium/WebdriverIoSessionFactory';

function createFakeBrowser() {
  const fakeElement = {
    click: jest.fn().mockResolvedValue(undefined),
    getText: jest.fn().mockResolvedValue('some text'),
    setValue: jest.fn().mockResolvedValue(undefined),
    clearValue: jest.fn().mockResolvedValue(undefined),
  };
  return {
    sessionId: 'abc-123',
    deleteSession: jest.fn().mockResolvedValue(undefined),
    activateApp: jest.fn().mockResolvedValue(undefined),
    terminateApp: jest.fn().mockResolvedValue(undefined),
    takeScreenshot: jest.fn().mockResolvedValue('base64data'),
    getPageSource: jest.fn().mockResolvedValue('<hierarchy/>'),
    getCurrentActivity: jest.fn().mockResolvedValue('.MainActivity'),
    getCurrentPackage: jest.fn().mockResolvedValue('com.example.app'),
    getWindowSize: jest.fn().mockResolvedValue({ width: 1080, height: 1920 }),
    execute: jest.fn().mockResolvedValue(undefined),
    back: jest.fn().mockResolvedValue(undefined),
    $: jest.fn().mockReturnValue({
      getElement: jest.fn().mockResolvedValue(fakeElement),
      isExisting: jest.fn().mockResolvedValue(true),
    }),
    fakeElement,
  };
}

const CONNECTION = { hostname: 'localhost', port: 4723, path: '/', protocol: 'http' };

describe('WebdriverIoSessionFactory', () => {
  beforeEach(() => {
    mockRemote.mockReset();
  });

  it('calls webdriverio.remote() with the connection options and capabilities', async () => {
    const fakeBrowser = createFakeBrowser();
    mockRemote.mockResolvedValue(fakeBrowser);

    const factory = new WebdriverIoSessionFactory();
    const capabilities = { platformName: 'Android' };

    const handle = await factory.createRemote(CONNECTION, capabilities);

    expect(mockRemote).toHaveBeenCalledWith({
      hostname: 'localhost',
      port: 4723,
      path: '/',
      protocol: 'http',
      capabilities,
    });
    expect(handle.sessionId).toBe('abc-123');
  });

  it('delegates lifecycle/capture/navigation calls directly to the underlying browser', async () => {
    const fakeBrowser = createFakeBrowser();
    mockRemote.mockResolvedValue(fakeBrowser);
    const factory = new WebdriverIoSessionFactory();

    const handle = await factory.createRemote(CONNECTION, {});

    await handle.deleteSession();
    await handle.activateApp('com.example.app');
    await handle.terminateApp('com.example.app');
    await handle.takeScreenshot();
    await handle.getPageSource();
    await handle.getCurrentActivity();
    await handle.getCurrentPackage();
    await handle.getWindowSize();
    await handle.back();

    expect(fakeBrowser.deleteSession).toHaveBeenCalled();
    expect(fakeBrowser.activateApp).toHaveBeenCalledWith('com.example.app');
    expect(fakeBrowser.terminateApp).toHaveBeenCalledWith('com.example.app');
    expect(fakeBrowser.takeScreenshot).toHaveBeenCalled();
    expect(fakeBrowser.getPageSource).toHaveBeenCalled();
    expect(fakeBrowser.getCurrentActivity).toHaveBeenCalled();
    expect(fakeBrowser.getCurrentPackage).toHaveBeenCalled();
    expect(fakeBrowser.getWindowSize).toHaveBeenCalled();
    expect(fakeBrowser.back).toHaveBeenCalled();
  });

  it('adapts findElement() to browser.$(selector).getElement(), returning a click/getText/setValue handle', async () => {
    const fakeBrowser = createFakeBrowser();
    mockRemote.mockResolvedValue(fakeBrowser);
    const factory = new WebdriverIoSessionFactory();

    const handle = await factory.createRemote(CONNECTION, {});
    const element = await handle.findElement('id:com.example.app:id/button');
    await element.click();
    await expect(element.getText()).resolves.toBe('some text');
    await element.setValue('hello');

    expect(fakeBrowser.$).toHaveBeenCalledWith('id:com.example.app:id/button');
    expect(fakeBrowser.fakeElement.click).toHaveBeenCalled();
    expect(fakeBrowser.fakeElement.getText).toHaveBeenCalled();
    expect(fakeBrowser.fakeElement.setValue).toHaveBeenCalledWith('hello');
  });

  it('delegates elementExists() to browser.$(selector).isExisting()', async () => {
    const fakeBrowser = createFakeBrowser();
    mockRemote.mockResolvedValue(fakeBrowser);
    const factory = new WebdriverIoSessionFactory();

    const handle = await factory.createRemote(CONNECTION, {});
    await expect(handle.elementExists('id:com.example.app:id/button')).resolves.toBe(true);

    expect(fakeBrowser.$).toHaveBeenCalledWith('id:com.example.app:id/button');
  });

  it('delegates executeScript() to browser.execute()', async () => {
    const fakeBrowser = createFakeBrowser();
    mockRemote.mockResolvedValue(fakeBrowser);
    const factory = new WebdriverIoSessionFactory();

    const handle = await factory.createRemote(CONNECTION, {});
    await handle.executeScript('mobile: scrollGesture', { direction: 'down' });

    expect(fakeBrowser.execute).toHaveBeenCalledWith('mobile: scrollGesture', {
      direction: 'down',
    });
  });

  it('propagates a rejection from webdriverio.remote()', async () => {
    mockRemote.mockRejectedValue(new Error('ECONNREFUSED'));
    const factory = new WebdriverIoSessionFactory();

    await expect(factory.createRemote(CONNECTION, {})).rejects.toThrow('ECONNREFUSED');
  });
});
