import { AndroidAppiumDriver } from '../../../../src/infrastructure/appium/AndroidAppiumDriver';
import {
  IWebdriverSessionFactory,
  RemoteConnectionOptions,
} from '../../../../src/infrastructure/appium/IWebdriverSessionFactory';
import { IAppiumSessionHandle } from '../../../../src/infrastructure/appium/IAppiumSessionHandle';
import { ICapabilitiesBuilder } from '../../../../src/application/interfaces/appium/ICapabilitiesBuilder';
import { SessionCreationError } from '../../../../src/core/errors/SessionCreationError';
import { SessionDestructionError } from '../../../../src/core/errors/SessionDestructionError';
import { AppLaunchError } from '../../../../src/core/errors/AppLaunchError';
import { AppCloseError } from '../../../../src/core/errors/AppCloseError';
import { SessionRecoveryError } from '../../../../src/core/errors/SessionRecoveryError';
import { SessionNotActiveError } from '../../../../src/core/errors/SessionNotActiveError';
import { ScreenCaptureError } from '../../../../src/core/errors/ScreenCaptureError';
import { TapError } from '../../../../src/core/errors/TapError';
import { NavigationError } from '../../../../src/core/errors/NavigationError';
import { SendKeysError } from '../../../../src/core/errors/SendKeysError';
import { ClearTextError } from '../../../../src/core/errors/ClearTextError';
import { ImeActionError } from '../../../../src/core/errors/ImeActionError';
import { ScrollError } from '../../../../src/core/errors/ScrollError';
import { SwipeError } from '../../../../src/core/errors/SwipeError';
import { GetTextError } from '../../../../src/core/errors/GetTextError';
import { ElementExistsCheckError } from '../../../../src/core/errors/ElementExistsCheckError';
import { Platform } from '../../../../src/core/enums/Platform';
import { LocatorStrategy } from '../../../../src/core/enums/LocatorStrategy';
import { ScrollDirection } from '../../../../src/core/enums/ScrollDirection';
import { createMockLogger } from '../../support/createMockLogger';

function createMockHandle(sessionId: string): jest.Mocked<IAppiumSessionHandle> {
  return {
    sessionId,
    deleteSession: jest.fn().mockResolvedValue(undefined),
    activateApp: jest.fn().mockResolvedValue(undefined),
    terminateApp: jest.fn().mockResolvedValue(undefined),
    takeScreenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png-bytes').toString('base64')),
    getPageSource: jest.fn().mockResolvedValue('<hierarchy/>'),
    getCurrentActivity: jest.fn().mockResolvedValue('.MainActivity'),
    getCurrentPackage: jest.fn().mockResolvedValue('com.example.app'),
    findElement: jest.fn().mockResolvedValue({
      click: jest.fn().mockResolvedValue(undefined),
      getText: jest.fn().mockResolvedValue(''),
      setValue: jest.fn().mockResolvedValue(undefined),
      clearValue: jest.fn().mockResolvedValue(undefined),
    }),
    elementExists: jest.fn().mockResolvedValue(true),
    getWindowSize: jest.fn().mockResolvedValue({ width: 1080, height: 1920 }),
    executeScript: jest.fn().mockResolvedValue(undefined),
    back: jest.fn().mockResolvedValue(undefined),
  };
}

const CONNECTION: RemoteConnectionOptions = {
  hostname: 'localhost',
  port: 4723,
  path: '/',
  protocol: 'http',
};
const CAPABILITIES = { platformName: 'Android' };

function createDriver() {
  const sessionFactory: jest.Mocked<IWebdriverSessionFactory> = { createRemote: jest.fn() };
  const capabilitiesBuilder: jest.Mocked<ICapabilitiesBuilder> = {
    build: jest.fn().mockReturnValue(CAPABILITIES),
  };
  const logger = createMockLogger();
  const driver = new AndroidAppiumDriver(sessionFactory, capabilitiesBuilder, logger, CONNECTION);
  return { driver, sessionFactory, capabilitiesBuilder, logger };
}

describe('AndroidAppiumDriver', () => {
  describe('createSession', () => {
    it('builds capabilities, creates a remote session, and returns an AppiumSession', async () => {
      const { driver, sessionFactory, capabilitiesBuilder, logger } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);

      const options = { deviceId: 'emulator-5554', appPackage: 'com.example.app' };
      const session = await driver.createSession(options);

      expect(capabilitiesBuilder.build).toHaveBeenCalledWith(options);
      expect(sessionFactory.createRemote).toHaveBeenCalledWith(CONNECTION, CAPABILITIES);
      expect(session.sessionId).toBe('abc-123');
      expect(session.deviceId).toBe('emulator-5554');
      expect(session.platform).toBe(Platform.ANDROID);
      expect(driver.isSessionActive()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Creating Appium session',
        expect.objectContaining({ deviceId: 'emulator-5554' }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Appium session created',
        expect.objectContaining({ sessionId: 'abc-123' }),
      );
    });

    it('throws SessionCreationError when the session factory rejects, and logs the underlying error', async () => {
      const { driver, sessionFactory, logger } = createDriver();
      sessionFactory.createRemote.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(driver.createSession({ deviceId: 'emulator-5554' })).rejects.toBeInstanceOf(
        SessionCreationError,
      );
      expect(driver.isSessionActive()).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('destroySession', () => {
    it('is a no-op when there is no active session', async () => {
      const { driver } = createDriver();

      await expect(driver.destroySession()).resolves.toBeUndefined();
      expect(driver.isSessionActive()).toBe(false);
    });

    it('deletes the session and clears active state', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.destroySession();

      expect(handle.deleteSession).toHaveBeenCalledTimes(1);
      expect(driver.isSessionActive()).toBe(false);
    });

    it('throws SessionDestructionError and still clears the session when deleteSession fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.deleteSession.mockRejectedValue(new Error('already gone'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.destroySession()).rejects.toBeInstanceOf(SessionDestructionError);
      expect(driver.isSessionActive()).toBe(false);
    });
  });

  describe('launchApp', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.launchApp('com.example.app')).rejects.toBeInstanceOf(
        SessionNotActiveError,
      );
    });

    it('activates the app on the current session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.launchApp('com.example.app');

      expect(handle.activateApp).toHaveBeenCalledWith('com.example.app');
    });

    it('throws AppLaunchError when activateApp fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.activateApp.mockRejectedValue(new Error('app not installed'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.launchApp('com.example.app')).rejects.toBeInstanceOf(AppLaunchError);
    });
  });

  describe('closeApp', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.closeApp('com.example.app')).rejects.toBeInstanceOf(
        SessionNotActiveError,
      );
    });

    it('terminates the app on the current session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.closeApp('com.example.app');

      expect(handle.terminateApp).toHaveBeenCalledWith('com.example.app');
    });

    it('throws AppCloseError when terminateApp fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.terminateApp.mockRejectedValue(new Error('device offline'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.closeApp('com.example.app')).rejects.toBeInstanceOf(AppCloseError);
    });
  });

  describe('getSession', () => {
    it('returns null when no session has been created', () => {
      const { driver } = createDriver();

      expect(driver.getSession()).toBeNull();
    });

    it('returns the current session details after creation', async () => {
      const { driver, sessionFactory } = createDriver();
      sessionFactory.createRemote.mockResolvedValue(createMockHandle('abc-123'));
      await driver.createSession({ deviceId: 'emulator-5554' });

      const session = driver.getSession();

      expect(session?.sessionId).toBe('abc-123');
      expect(session?.deviceId).toBe('emulator-5554');
    });
  });

  describe('recoverSession', () => {
    it('throws SessionRecoveryError when no session has ever been created', async () => {
      const { driver } = createDriver();

      await expect(driver.recoverSession()).rejects.toBeInstanceOf(SessionRecoveryError);
    });

    it('discards the dead session and creates a fresh one with the same options', async () => {
      const { driver, sessionFactory, logger } = createDriver();
      const firstHandle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValueOnce(firstHandle);
      const options = { deviceId: 'emulator-5554', appPackage: 'com.example.app' };
      await driver.createSession(options);

      const secondHandle = createMockHandle('def-456');
      sessionFactory.createRemote.mockResolvedValueOnce(secondHandle);

      const recovered = await driver.recoverSession();

      expect(firstHandle.deleteSession).toHaveBeenCalledTimes(1);
      expect(sessionFactory.createRemote).toHaveBeenLastCalledWith(CONNECTION, CAPABILITIES);
      expect(recovered.sessionId).toBe('def-456');
      expect(driver.isSessionActive()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Recovering Appium session',
        expect.objectContaining({ deviceId: 'emulator-5554' }),
      );
    });

    it('still recovers even if discarding the dead session throws', async () => {
      const { driver, sessionFactory } = createDriver();
      const firstHandle = createMockHandle('abc-123');
      firstHandle.deleteSession.mockRejectedValue(new Error('session already terminated'));
      sessionFactory.createRemote.mockResolvedValueOnce(firstHandle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      sessionFactory.createRemote.mockResolvedValueOnce(createMockHandle('def-456'));

      await expect(driver.recoverSession()).resolves.toMatchObject({ sessionId: 'def-456' });
    });

    it('throws SessionRecoveryError when re-creating the session fails', async () => {
      const { driver, sessionFactory } = createDriver();
      sessionFactory.createRemote.mockResolvedValueOnce(createMockHandle('abc-123'));
      await driver.createSession({ deviceId: 'emulator-5554' });

      sessionFactory.createRemote.mockRejectedValueOnce(new Error('server unreachable'));

      await expect(driver.recoverSession()).rejects.toBeInstanceOf(SessionRecoveryError);
    });
  });

  describe('takeScreenshot', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.takeScreenshot()).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('decodes the base64 result from the session into a Buffer', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.takeScreenshot.mockResolvedValue(Buffer.from('png-bytes').toString('base64'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      const screenshot = await driver.takeScreenshot();

      expect(screenshot).toEqual(Buffer.from('png-bytes'));
    });

    it('throws ScreenCaptureError when the session command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.takeScreenshot.mockRejectedValue(new Error('device disconnected'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.takeScreenshot()).rejects.toBeInstanceOf(ScreenCaptureError);
    });
  });

  describe('getPageSource', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.getPageSource()).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('returns the XML hierarchy from the session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getPageSource.mockResolvedValue('<hierarchy><node/></hierarchy>');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.getPageSource()).resolves.toBe('<hierarchy><node/></hierarchy>');
    });

    it('throws ScreenCaptureError when the session command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getPageSource.mockRejectedValue(new Error('device disconnected'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.getPageSource()).rejects.toBeInstanceOf(ScreenCaptureError);
    });
  });

  describe('getCurrentPackage', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.getCurrentPackage()).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('returns the foreground package name from the session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getCurrentPackage.mockResolvedValue('com.example.calculator');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.getCurrentPackage()).resolves.toBe('com.example.calculator');
    });

    it('throws ScreenCaptureError when the session command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getCurrentPackage.mockRejectedValue(new Error('device disconnected'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.getCurrentPackage()).rejects.toBeInstanceOf(ScreenCaptureError);
    });
  });

  describe('getCurrentActivity', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.getCurrentActivity()).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('returns the foreground activity name from the session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getCurrentActivity.mockResolvedValue('.MainActivity');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.getCurrentActivity()).resolves.toBe('.MainActivity');
    });

    it('throws ScreenCaptureError when the session command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getCurrentActivity.mockRejectedValue(new Error('device disconnected'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.getCurrentActivity()).rejects.toBeInstanceOf(ScreenCaptureError);
    });
  });

  describe('tap', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(
        driver.tap({ strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' }),
      ).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('finds the element via the correct selector for each strategy and clicks it', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      const clickMock = jest.fn().mockResolvedValue(undefined);
      handle.findElement.mockResolvedValue({
        click: clickMock,
        getText: jest.fn(),
        setValue: jest.fn(),
        clearValue: jest.fn().mockResolvedValue(undefined),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.tap({ strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' });
      expect(handle.findElement).toHaveBeenCalledWith('id:com.example.app:id/btn');

      await driver.tap({ strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Submit' });
      expect(handle.findElement).toHaveBeenCalledWith('accessibility id:Submit');

      await driver.tap({
        strategy: LocatorStrategy.XPATH_CLASS_INDEX,
        value: '/android.widget.FrameLayout[1]/android.widget.Button[1]',
      });
      expect(handle.findElement).toHaveBeenCalledWith(
        '/android.widget.FrameLayout[1]/android.widget.Button[1]',
      );

      await driver.tap({
        strategy: LocatorStrategy.ANDROID_UIAUTOMATOR,
        value: 'new UiSelector().text("My Gifts")',
      });
      expect(handle.findElement).toHaveBeenCalledWith('android=new UiSelector().text("My Gifts")');

      expect(clickMock).toHaveBeenCalledTimes(4);
    });

    it('throws TapError when the element cannot be found', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.findElement.mockRejectedValue(new Error('no such element'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.tap({ strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' }),
      ).rejects.toBeInstanceOf(TapError);
    });

    it('throws TapError when the click itself fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.findElement.mockResolvedValue({
        click: jest.fn().mockRejectedValue(new Error('element not interactable')),
        getText: jest.fn(),
        setValue: jest.fn(),
        clearValue: jest.fn().mockResolvedValue(undefined),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.tap({ strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' }),
      ).rejects.toBeInstanceOf(TapError);
    });

    it('taps via a mobile:clickGesture at the parsed coordinates, bypassing findElement entirely', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.tap({ strategy: LocatorStrategy.COORDINATES, value: '200,130' });

      expect(handle.executeScript).toHaveBeenCalledWith('mobile: clickGesture', { x: 200, y: 130 });
      expect(handle.findElement).not.toHaveBeenCalled();
    });

    it('throws TapError when the coordinates locator value is malformed', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.tap({ strategy: LocatorStrategy.COORDINATES, value: 'not-a-coordinate' }),
      ).rejects.toBeInstanceOf(TapError);
    });

    it('throws TapError when the clickGesture command itself fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.executeScript.mockRejectedValue(new Error('gesture not supported'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.tap({ strategy: LocatorStrategy.COORDINATES, value: '200,130' }),
      ).rejects.toBeInstanceOf(TapError);
    });
  });

  describe('back', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.back()).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('navigates back via the session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.back();

      expect(handle.back).toHaveBeenCalledTimes(1);
    });

    it('throws NavigationError when back() fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.back.mockRejectedValue(new Error('device disconnected'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.back()).rejects.toBeInstanceOf(NavigationError);
    });
  });

  describe('sendKeys', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(
        driver.sendKeys(
          { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/input' },
          'hello',
        ),
      ).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('finds the element and sets its value', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      const setValueMock = jest.fn().mockResolvedValue(undefined);
      handle.findElement.mockResolvedValue({
        click: jest.fn(),
        getText: jest.fn(),
        setValue: setValueMock,
        clearValue: jest.fn(),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.sendKeys(
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/input' },
        'hello',
      );

      expect(handle.findElement).toHaveBeenCalledWith('id:com.example.app:id/input');
      expect(setValueMock).toHaveBeenCalledWith('hello');
    });

    it('falls back to focusing the element and typing when setValue is rejected', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      const clickMock = jest.fn().mockResolvedValue(undefined);
      handle.findElement.mockResolvedValue({
        click: clickMock,
        getText: jest.fn(),
        setValue: jest.fn().mockRejectedValue(new Error('ACTION_SET_PROGRESS has failed')),
        clearValue: jest.fn(),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.sendKeys(
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/input' },
        'hello',
      );

      expect(clickMock).toHaveBeenCalled();
      expect(handle.executeScript).toHaveBeenCalledWith('mobile: type', { text: 'hello' });
    });

    it('throws SendKeysError when setValue fails and the type fallback also fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.findElement.mockResolvedValue({
        click: jest.fn().mockRejectedValue(new Error('element not interactable')),
        getText: jest.fn(),
        setValue: jest.fn().mockRejectedValue(new Error('element not interactable')),
        clearValue: jest.fn(),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.sendKeys(
          { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/input' },
          'hello',
        ),
      ).rejects.toBeInstanceOf(SendKeysError);
    });

    it('types via a coordinate tap + mobile:type, bypassing findElement entirely, when the locator is COORDINATES', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.sendKeys({ strategy: LocatorStrategy.COORDINATES, value: '200,130' }, 'hello');

      expect(handle.executeScript).toHaveBeenCalledWith('mobile: clickGesture', { x: 200, y: 130 });
      expect(handle.executeScript).toHaveBeenCalledWith('mobile: type', { text: 'hello' });
      expect(handle.findElement).not.toHaveBeenCalled();
    });

    it('throws SendKeysError when the coordinates locator value is malformed', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.sendKeys(
          { strategy: LocatorStrategy.COORDINATES, value: 'not-a-coordinate' },
          'hello',
        ),
      ).rejects.toBeInstanceOf(SendKeysError);
    });

    it('throws SendKeysError when the mobile:type command itself fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.executeScript.mockImplementation(async (script) => {
        if (script === 'mobile: type') {
          throw new Error('keyboard not available');
        }
        return undefined;
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.sendKeys({ strategy: LocatorStrategy.COORDINATES, value: '200,130' }, 'hello'),
      ).rejects.toBeInstanceOf(SendKeysError);
    });
  });

  describe('clearText', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(
        driver.clearText({ strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/q' }),
      ).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('finds the element and clears it', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      const clearValueMock = jest.fn().mockResolvedValue(undefined);
      handle.findElement.mockResolvedValue({
        click: jest.fn(),
        getText: jest.fn(),
        setValue: jest.fn(),
        clearValue: clearValueMock,
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.clearText({
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/q',
      });

      expect(handle.findElement).toHaveBeenCalledWith('id:com.example.app:id/q');
      expect(clearValueMock).toHaveBeenCalled();
    });

    it('throws ClearTextError when clearing fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.findElement.mockResolvedValue({
        click: jest.fn(),
        getText: jest.fn(),
        setValue: jest.fn(),
        clearValue: jest.fn().mockRejectedValue(new Error('not editable')),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.clearText({ strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/q' }),
      ).rejects.toBeInstanceOf(ClearTextError);
    });
  });

  describe('pressImeAction', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.pressImeAction('search')).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('performs the named editor action', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.pressImeAction('search');

      expect(handle.executeScript).toHaveBeenCalledWith('mobile: performEditorAction', {
        action: 'search',
      });
    });

    it('throws ImeActionError when the command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.executeScript.mockRejectedValue(new Error('no focused editor'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.pressImeAction('search')).rejects.toBeInstanceOf(ImeActionError);
    });
  });

  describe('getText', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(
        driver.getText({
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/label',
        }),
      ).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('finds the element and returns its text', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.findElement.mockResolvedValue({
        click: jest.fn(),
        getText: jest.fn().mockResolvedValue('Result: 42'),
        setValue: jest.fn(),
        clearValue: jest.fn().mockResolvedValue(undefined),
      });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.getText({
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/label',
        }),
      ).resolves.toBe('Result: 42');
    });

    it('throws GetTextError when the underlying command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.findElement.mockRejectedValue(new Error('no such element'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.getText({
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/label',
        }),
      ).rejects.toBeInstanceOf(GetTextError);
    });
  });

  describe('elementExists', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(
        driver.elementExists({
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/label',
        }),
      ).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('returns the session existence check result', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.elementExists.mockResolvedValue(false);
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.elementExists({
          strategy: LocatorStrategy.ACCESSIBILITY_ID,
          value: 'Submit',
        }),
      ).resolves.toBe(false);
      expect(handle.elementExists).toHaveBeenCalledWith('accessibility id:Submit');
    });

    it('treats a coordinates locator as always existing, without querying the session', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.elementExists({ strategy: LocatorStrategy.COORDINATES, value: '200,130' }),
      ).resolves.toBe(true);
      expect(handle.elementExists).not.toHaveBeenCalled();
    });

    it('throws ElementExistsCheckError when the underlying command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.elementExists.mockRejectedValue(new Error('device disconnected'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(
        driver.elementExists({
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/label',
        }),
      ).rejects.toBeInstanceOf(ElementExistsCheckError);
    });
  });

  describe('scroll', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.scroll(ScrollDirection.DOWN)).rejects.toBeInstanceOf(
        SessionNotActiveError,
      );
    });

    it('reads the window size and executes a scroll gesture in the requested direction', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.getWindowSize.mockResolvedValue({ width: 1000, height: 2000 });
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.scroll(ScrollDirection.UP);

      expect(handle.getWindowSize).toHaveBeenCalledTimes(1);
      expect(handle.executeScript).toHaveBeenCalledWith(
        'mobile: scrollGesture',
        expect.objectContaining({ direction: ScrollDirection.UP }),
      );
    });

    it('throws ScrollError when the gesture command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.executeScript.mockRejectedValue(new Error('gesture not supported'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.scroll(ScrollDirection.DOWN)).rejects.toBeInstanceOf(ScrollError);
    });
  });

  describe('swipe', () => {
    it('throws SessionNotActiveError when no session exists', async () => {
      const { driver } = createDriver();

      await expect(driver.swipe(400, 1850, 400, 950)).rejects.toBeInstanceOf(SessionNotActiveError);
    });

    it('executes a raw drag gesture between the given coordinates', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await driver.swipe(400, 1850, 400, 950);

      expect(handle.executeScript).toHaveBeenCalledWith(
        'mobile: dragGesture',
        expect.objectContaining({ startX: 400, startY: 1850, endX: 400, endY: 950 }),
      );
    });

    it('throws SwipeError when the gesture command fails', async () => {
      const { driver, sessionFactory } = createDriver();
      const handle = createMockHandle('abc-123');
      handle.executeScript.mockRejectedValue(new Error('gesture not supported'));
      sessionFactory.createRemote.mockResolvedValue(handle);
      await driver.createSession({ deviceId: 'emulator-5554' });

      await expect(driver.swipe(400, 1850, 400, 950)).rejects.toBeInstanceOf(SwipeError);
    });
  });
});
