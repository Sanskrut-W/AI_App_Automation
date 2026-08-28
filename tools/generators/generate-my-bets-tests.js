/**
 * Generates the My Bets module's test cases.
 *
 * Kept separate from the hamburger-menu tour on purpose: the tour proves every drawer item *opens*,
 * whereas these exercise behaviour *inside* My Bets. Written as a list of case definitions sharing
 * one login prelude so further My Bets cases can be added by appending to CASES.
 *
 * Usage: node generate-my-bets-tests.js
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'apps', 'com.betwayafrica.za', 'test-cases', 'manual');
const SCREEN_ID = 'f53e9f8c-0f56-4de0-a195-56d43791fce8';

/**
 * Credentials are emitted as placeholders, resolved at execution time against the test account
 * assigned to the device being driven (see src/application/use-cases/test-execution/
 * resolveCredentialTokens.ts). Two consequences worth having: one test case can run on several
 * devices at once signed in as different accounts, and the generated JSON holds no password.
 */
const CREDENTIAL = {
  mobileNumber: '{{account.mobileNumber}}',
  password: '{{account.password}}',
};

const RES = (id) => ({ strategy: 'resource-id', value: `com.betwayafrica.za:id/${id}` });
/** A drawer row, matched on its own navTitle id — several drawer labels are duplicated elsewhere
 *  on screen ("My Bets" is also a non-clickable bottom-nav label), and only navTitle is unique. */
const NAV_ROW = (label) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@resource-id="com.betwayafrica.za:id/navTitle" and @text="${label}"]`,
});
/** Text inside the My Bets WebView. Those nodes carry no resource-id and report clickable="false",
 *  but a tap on them is handled by the WebView anyway — the same thing that makes the
 *  "modal-close-btn" popup control work, verified live. */
const WEB_TEXT = (text) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@text="${text}"]`,
});
const DRAWER_SCROLL = (label) => ({
  strategy: 'android-uiautomator',
  value: `new UiScrollable(new UiSelector().resourceId("com.betwayafrica.za:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().resourceId("com.betwayafrica.za:id/navTitle").text("${label}"))`,
});

function createBuilder() {
  const steps = [];
  let n = 0;
  const base = { targetLocator: null, elementId: null, value: null, direction: null, durationMs: null };
  const push = (step) => {
    n += 1;
    steps.push({ stepNumber: n, ...base, ...step });
  };
  return { steps, push };
}

/** Signs in and leaves the session asserted, with "Before login"/"After login" checkpoints. */
function pushLogin({ push }) {
  push({ action: 'verify_element_exists', targetLocator: RES('toolbarLogin'), expectedResult: 'The app is logged out and the Log In button is present.', screenshotLabel: 'Before login' });
  push({ action: 'click', targetLocator: RES('toolbarLogin'), expectedResult: 'The login sheet opens.' });
  push({ action: 'verify_element_exists', targetLocator: RES('loginMobileNumber'), expectedResult: 'The mobile number field is present.' });
  push({ action: 'click', targetLocator: RES('loginMobileNumber'), expectedResult: 'The mobile number field gains focus.' });
  push({ action: 'type', targetLocator: RES('loginMobileNumber'), value: CREDENTIAL.mobileNumber, expectedResult: 'The mobile number is entered.' });
  push({ action: 'verify_element_exists', targetLocator: RES('passwordInput'), expectedResult: 'The password field is present.' });
  push({ action: 'click', targetLocator: RES('passwordInput'), expectedResult: 'The password field gains focus.' });
  push({ action: 'type', targetLocator: RES('passwordInput'), value: CREDENTIAL.password, expectedResult: 'The password is entered.' });
  push({ action: 'verify_element_exists', targetLocator: RES('loginSignIn'), expectedResult: 'The Log In button is present.' });
  push({ action: 'click', targetLocator: RES('loginSignIn'), expectedResult: 'The sign-in request is submitted.' });

  // The biometric-enrolment prompt is physical-device only and appears on its own schedule — it has
  // been observed still absent 3.5s after sign-in — so retry Skip a few times, spaced out. Always
  // Skip, never Allow: this is a real account and we do not enrol biometrics on it.
  push({ action: 'wait', durationMs: 3000, expectedResult: 'The sign-in request gets under way.' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    push({ action: 'click', targetLocator: RES('biometricSkip'), optional: true, expectedResult: `Attempt ${attempt + 1} of 3: dismisses the post-login Biometric Setup prompt via Skip if it has appeared; otherwise a no-op.` });
    push({ action: 'wait', durationMs: 2000, expectedResult: 'Gives the prompt time to appear, or to finish dismissing, before the next attempt.' });
  }

  // A promo interstitial and/or a "Withdrawal Alert" can stack over the toolbar, both under the
  // same "modal-close-btn" id, with 0, 1 or 2 layers present. Matched by xpath, not the
  // "resource-id" strategy: that strategy maps to Appium's "id" locator, which prefixes a bare id
  // with the app package, so it can never resolve a WebView id that has no package part. Verified
  // live — `id=modal-close-btn` does not resolve where this xpath does. These steps are optional,
  // so the mismatch was silently passing as a no-op rather than failing.
  for (let i = 0; i < 2; i += 1) {
    push({ action: 'click', targetLocator: { strategy: 'xpath-text', value: '//*[@resource-id="modal-close-btn"]' }, optional: true, expectedResult: 'Closes a post-login popup layer if one is present; otherwise a no-op.' });
    push({ action: 'wait', durationMs: 800, expectedResult: 'Any popup dismissal settles.' });
  }

  // verify_element_exists is an instantaneous check with no implicit wait, and on a congested
  // network sign-in has been seen still spinning ~10s after submit, so give it real slack.
  for (let i = 0; i < 3; i += 1) {
    push({ action: 'wait', durationMs: 3000, expectedResult: 'Further time for a slow sign-in to complete before the session is asserted.' });
  }
  push({ action: 'verify_element_exists', targetLocator: RES('toolbarDeposit'), expectedResult: 'The toolbar shows the logged-in Deposit control, proving the account is actually signed in rather than merely that the taps landed.', screenshotLabel: 'After login' });
}

/** Opens a drawer item by label. */
function pushOpenDrawerItem({ push }, label) {
  push({ action: 'verify_element_exists', targetLocator: { strategy: 'accessibility-id', value: 'Open' }, expectedResult: 'The hamburger menu button is present.' });
  push({ action: 'click', targetLocator: { strategy: 'accessibility-id', value: 'Open' }, expectedResult: 'The hamburger menu drawer opens.' });
  push({ action: 'wait', durationMs: 1000, expectedResult: 'The drawer finishes opening.' });
  // The drawer list is virtualized: a row that has not been scrolled near the viewport is absent
  // from the hierarchy entirely. scrollIntoView keeps swiping on-device until it materialises, so
  // no per-device swipe calibration is needed. Optional because taller screens may already show it.
  push({ action: 'verify_element_exists', targetLocator: DRAWER_SCROLL(label), optional: true, expectedResult: `The drawer scrolls until ${label} is rendered, if it was not already visible.` });
  push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
  push({ action: 'verify_element_exists', targetLocator: NAV_ROW(label), expectedResult: `The ${label} row is visible in the drawer.` });
  push({ action: 'click', targetLocator: NAV_ROW(label), expectedResult: `Tapping ${label} navigates to it.` });
}

const CASES = [
  {
    testCaseId: 'c1a7f3d2-5b84-4e19-9f60-2d8e7a41b6c3',
    sequence: 20,
    title: 'My Bets: open the Open Bets and Settled Bets tabs.',
    description:
      'Logs in, opens My Bets from the hamburger menu, then switches between the Open Bets and Settled Bets tabs, capturing one screenshot of each as proof it rendered. Read-only: nothing is placed, cashed out or cancelled. The tab labels are WebView text with no resource-id, matched by exact text — each appears exactly once on this screen, verified live.',
    build(b) {
      pushLogin(b);
      pushOpenDrawerItem(b, 'My Bets');

      // My Bets is a WebView, so give it room to render before asserting on its contents.
      b.push({ action: 'wait', durationMs: 3500, expectedResult: 'The My Bets page finishes loading.' });
      b.push({ action: 'verify_element_exists', targetLocator: WEB_TEXT('Open Bets'), expectedResult: 'The My Bets page is open — the Open Bets tab label is a marker unique to this page. Deliberately not asserted via the "my-bets-container" id, which is present on several other tabs too and gave a proven false positive.' });

      b.push({ action: 'click', targetLocator: WEB_TEXT('Open Bets'), expectedResult: 'The Open Bets tab is selected.' });
      b.push({ action: 'wait', durationMs: 2500, expectedResult: "The Open Bets list finishes rendering (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Open Bets' });

      b.push({ action: 'verify_element_exists', targetLocator: WEB_TEXT('Settled Bets'), expectedResult: 'The Settled Bets tab is available.' });
      b.push({ action: 'click', targetLocator: WEB_TEXT('Settled Bets'), expectedResult: 'The Settled Bets tab is selected.' });
      b.push({ action: 'wait', durationMs: 2500, expectedResult: "The Settled Bets list finishes rendering (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Settled Bets' });
    },
  },
];

for (const testCase of CASES) {
  const builder = createBuilder();
  testCase.build(builder);
  const json = {
    testCaseId: testCase.testCaseId,
    screenId: SCREEN_ID,
    title: testCase.title,
    description: testCase.description,
    steps: builder.steps,
    priority: 'high',
    tags: ['manual', 'my-bets', 'login'],
    appVersionName: '5.1.5',
    appVersionCode: '123',
    sequence: testCase.sequence,
  };
  const outPath = path.join(OUT_DIR, `${testCase.testCaseId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2) + '\n');
  console.log(
    `Wrote ${outPath}\n  ${builder.steps.length} steps, ` +
      `${builder.steps.filter((s) => s.screenshotLabel).length} screenshots: ` +
      builder.steps.filter((s) => s.screenshotLabel).map((s) => s.screenshotLabel).join(' | '),
  );
}
