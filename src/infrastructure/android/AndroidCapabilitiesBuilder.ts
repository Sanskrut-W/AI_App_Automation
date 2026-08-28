import { ICapabilitiesBuilder } from '../../application/interfaces/appium/ICapabilitiesBuilder';
import { CreateSessionOptions } from '../../application/dto/CreateSessionOptions';

/** The single place Android/UiAutomator2 desired capabilities are shaped — nothing else builds them. */
export class AndroidCapabilitiesBuilder implements ICapabilitiesBuilder {
  /**
   * @param baseCapabilities Extra capabilities applied to every session, below any per-session
   * override. Used for host-level settings that vary per worker rather than per test — chiefly
   * "appium:systemPort" when several devices are driven at once (see below).
   */
  constructor(private readonly baseCapabilities: Record<string, unknown> = {}) {}

  build(options: CreateSessionOptions): Record<string, unknown> {
    const capabilities: Record<string, unknown> = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:udid': options.deviceId,
      'appium:noReset': options.noReset ?? true,
      // UiAutomator2's default tree-walk can hang for 10s+ per command (eventually never
      // recovering) on screens with deeply nested/overlapping WebViews, e.g. a popup opened on
      // top of another popup — proven live against Betway ZA's Login-opened-from-Sign-Up screen.
      'appium:settings[enforceXPath1]': true,
      // The default 20s adb exec timeout is too tight under real device/host load (a slow or
      // memory-constrained emulator can take longer than 20s to run a single "adb shell input
      // text" call) — proven live against Betway ZA, where typing steps hard-failed on the
      // default even though the same command succeeds given more time.
      'appium:adbExecTimeout': 60_000,
    };

    if (options.appPackage) {
      capabilities['appium:appPackage'] = options.appPackage;
    }
    if (options.appActivity) {
      capabilities['appium:appActivity'] = options.appActivity;
    }

    return { ...capabilities, ...this.baseCapabilities, ...options.capabilityOverrides };
  }
}
