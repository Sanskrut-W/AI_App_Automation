import { AndroidCapabilitiesBuilder } from '../../../../src/infrastructure/android/AndroidCapabilitiesBuilder';

describe('AndroidCapabilitiesBuilder', () => {
  it('builds the baseline UiAutomator2 capabilities for a device', () => {
    const builder = new AndroidCapabilitiesBuilder();

    const capabilities = builder.build({ deviceId: 'emulator-5554' });

    expect(capabilities).toEqual({
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:udid': 'emulator-5554',
      'appium:noReset': true,
      'appium:settings[enforceXPath1]': true,
      'appium:adbExecTimeout': 60_000,
    });
  });

  it('includes appPackage and appActivity when provided', () => {
    const builder = new AndroidCapabilitiesBuilder();

    const capabilities = builder.build({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.calculator',
      appActivity: '.MainActivity',
    });

    expect(capabilities['appium:appPackage']).toBe('com.example.calculator');
    expect(capabilities['appium:appActivity']).toBe('.MainActivity');
  });

  it('omits appPackage/appActivity when not provided', () => {
    const builder = new AndroidCapabilitiesBuilder();

    const capabilities = builder.build({ deviceId: 'emulator-5554' });

    expect(capabilities).not.toHaveProperty('appium:appPackage');
    expect(capabilities).not.toHaveProperty('appium:appActivity');
  });

  it('respects an explicit noReset value of false', () => {
    const builder = new AndroidCapabilitiesBuilder();

    const capabilities = builder.build({ deviceId: 'emulator-5554', noReset: false });

    expect(capabilities['appium:noReset']).toBe(false);
  });

  it('lets capabilityOverrides win over the built-in defaults', () => {
    const builder = new AndroidCapabilitiesBuilder();

    const capabilities = builder.build({
      deviceId: 'emulator-5554',
      capabilityOverrides: { 'appium:automationName': 'Espresso', 'appium:newCommandTimeout': 120 },
    });

    expect(capabilities['appium:automationName']).toBe('Espresso');
    expect(capabilities['appium:newCommandTimeout']).toBe(120);
  });
});
