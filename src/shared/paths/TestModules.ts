/** The set of independent test-case "modules" this platform can generate/execute for an app. Each
 * gets its own folder under the app's test-cases root (see AppPaths), and is executed in its own
 * isolated Appium session — so e.g. a real login never contaminates the hamburger-menu suite's
 * assumptions about what's on screen. */
export const TEST_MODULES = ['hamburger-menu', 'login', 'sign-up', 'manual'] as const;
export type TestModule = (typeof TEST_MODULES)[number];

export function isTestModule(value: string): value is TestModule {
  return (TEST_MODULES as readonly string[]).includes(value);
}
