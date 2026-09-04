/**
 * Generates the "My Bets" test case for any Betway regional build, ZA included.
 *
 * Read-only by design: it opens My Bets from the drawer and switches between the Open Bets and
 * Settled Bets tabs, capturing one screenshot of each as proof it rendered. Nothing is placed,
 * cashed out, cancelled or edited.
 *
 * ZA is the origin build — these locators were read off it first — and it is now generated from
 * here too, replacing the hand-written 39-step case that carried the same testCaseId. That older
 * copy predated the Samsung Pass discovery and had no decline step, so it was one system dialog
 * away from failing for reasons that looked nothing like the cause. Folding ZA in means a fix
 * found on one region reaches all four instead of three.
 *
 * The rest was verified against the live GH build rather than assumed from the ZA case:
 *
 *   - The tab labels are the SAME as ZA ("Open Bets", "Settled Bets"), and each appears exactly
 *     ONCE on the screen, so an exact-text xpath is unambiguous.
 *   - Those labels are separate nodes and do NOT include the count badge. The screen shows
 *     "Open Bets" beside a "1" chip, which could equally have been a single node reading
 *     "Open Bets 1" — in which case an exact match would have failed silently. The hierarchy
 *     settled it (see tools/generators/probe-drawer-row-screen.js).
 *   - The labels carry NO resource-id and report clickable="false", but a tap on them is handled by
 *     the WebView anyway — the same thing that makes the "modal-close-btn" control work.
 *   - "My Bets" itself appears TWICE (the page header and the bottom-nav label), which is why the
 *     drawer row is matched on its own navTitle id rather than on its text.
 *
 * The region fields here are deliberately a small local copy rather than a shared import from
 * generate-regional-hamburger-tour.js: that generator produces its file on require, so importing it
 * would run it. Six fields of duplication is the cheaper trade; unify behind a module if a third
 * case type appears.
 *
 * Usage: node generate-regional-my-bets.js --region <za|gh|ng|tz>
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CREDENTIAL = {
  mobileNumber: '{{account.mobileNumber}}',
  password: '{{account.password}}',
};

const REGIONS = {
  za: {
    pkg: 'com.betwayafrica.za',
    label: 'South Africa',
    /**
     * Deliberately the id the hand-written ZA case already used, so this regenerates that case in
     * place rather than leaving two ZA "My Bets" cases behind for someone to pick between.
     */
    testCaseId: 'c1a7f3d2-5b84-4e19-9f60-2d8e7a41b6c3',
    /** A real crawled screen, unlike the other regions' synthetic ids — ZA is the crawled build. */
    screenId: 'f53e9f8c-0f56-4de0-a195-56d43791fce8',
    appVersionName: '5.1.5',
    appVersionCode: '123',
    myBetsRow: 'My Bets',
    myBetsSection: 'My Account',
    sectionExpandedByDefault: true,
  },
  gh: {
    pkg: 'com.betwayafrica.gh',
    label: 'Ghana',
    testCaseId: 'e3a86b14-7d52-4c09-b6f8-1a45d9e07c23',
    /** Synthetic: no crawl has been run against this build. Only has to be non-empty and stable. */
    screenId: 'b91f2a7c-4d68-4e13-9a25-7c3f8e6d1b04',
    appVersionName: '4.0.6',
    appVersionCode: '106',
    /** The drawer row that opens My Bets, and the section it lives in. */
    myBetsRow: 'My Bets',
    myBetsSection: 'My Account',
    /** True when that section is already expanded when the drawer first opens on a cold start. */
    sectionExpandedByDefault: true,
  },
  ng: {
    // The NG build's package changed under us mid-session: com.betway.ng (v1.1.9) was replaced by
    // ng.betway.onlinegambling (v3.4.23), which is a different app id, not an upgrade in place.
    // Worth knowing that a region's package is not a stable identifier.
    pkg: 'ng.betway.onlinegambling',
    label: 'Nigeria',
    testCaseId: 'f52d9c07-3b61-4e88-a4d3-8c17e6b0925a',
    screenId: 'c4e70b83-1f29-4d56-b8a7-2e93f5c81d60',
    appVersionName: '3.4.23',
    appVersionCode: '98',
    /** Verified live: the row is in English on this build, and the tab labels match ZA/GH exactly. */
    myBetsRow: 'My Bets',
    myBetsSection: 'My Account',
    sectionExpandedByDefault: true,
  },
  tz: {
    pkg: 'com.betway.tz',
    label: 'Tanzania',
    testCaseId: 'a1b6f394-27c8-4d0e-9f53-6b81c4e2a70d',
    screenId: 'd8f34a61-95b7-4c22-a10e-7b62f9d3e845',
    appVersionName: '3.4.21',
    appVersionCode: '94',
    myBetsRow: 'My Bets',
    myBetsSection: 'My Account',
    sectionExpandedByDefault: true,
    /**
     * This build is translatable, and its drawer LABELS follow the app's language setting — the very
     * things this test locates rows by. Seen first-hand: with the language set to Swahili the drawer
     * read "Akaunti Yangu" / "Weka pesa" / "Mikeka Yangu" (My Account / Deposit / My Bets), and every
     * English locator here found nothing. The language selector lives in the drawer footer, below the
     * section list, and is a device-level preference that outlives the app.
     *
     * So the test asserts the precondition instead of assuming it: if someone switches the language,
     * this fails on a step that says exactly that, rather than on a mystifying "row not found" ten
     * steps later. It is checked as soon as the drawer is open, which is the first moment the control
     * exists — and it needs no scrolling, sitting in the fixed footer.
     */
    expectLanguage: { id: 'languageSelector', value: 'English' },
  },
};

const regionFlag = process.argv.indexOf('--region');
const REGION_KEY = regionFlag > -1 ? process.argv[regionFlag + 1] : null;
if (!REGION_KEY || !REGIONS[REGION_KEY]) {
  throw new Error(`usage: node generate-regional-my-bets.js --region <${Object.keys(REGIONS).join('|')}>`);
}
const R = REGIONS[REGION_KEY];
const PKG = R.pkg;
const NAV_TITLE = `${PKG}:id/navTitle`;
const NAV_ROW = `${PKG}:id/navContainerRow`;
const OUT_PATH = path.join(
  REPO_ROOT, 'artifacts', 'apps', PKG, 'test-cases', 'manual', `${R.testCaseId}.json`,
);

const steps = [];
let n = 0;
function push(step) {
  n += 1;
  steps.push({
    stepNumber: n,
    targetLocator: null, elementId: null, value: null, direction: null, durationMs: null,
    ...step,
  });
}

const RES = (id) => ({ strategy: 'resource-id', value: `${PKG}:id/${id}` });
const HAMBURGER = { strategy: 'accessibility-id', value: 'Open' };
const DRAWER_LIST = RES('leftNavigationItems');
const MODAL_CLOSE = { strategy: 'xpath-text', value: '//*[@resource-id="modal-close-btn"]' };
/** Text inside the My Bets WebView: no resource-id, reports clickable="false", taps work anyway. */
const WEB_TEXT = (text) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@text="${text}"]`,
});
const SECTION_HEADER = (label) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@resource-id="${NAV_TITLE}" and @text="${label}" and not(ancestor::*[@resource-id="${NAV_ROW}"])]`,
});
const SECTION_CHILD = (label) => ({
  strategy: 'xpath-text',
  value: `//*[@resource-id="${NAV_ROW}"]//android.widget.TextView[@resource-id="${NAV_TITLE}" and @text="${label}"]`,
});
const SCROLL_TO = (label) => ({
  strategy: 'android-uiautomator',
  value: `new UiScrollable(new UiSelector().resourceId("${PKG}:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().resourceId("${NAV_TITLE}").text("${label}"))`,
});

function pushOpenDrawer() {
  push({ action: 'verify_element_exists', targetLocator: HAMBURGER, expectedResult: 'The hamburger menu button is present.' });
  push({ action: 'click', targetLocator: HAMBURGER, expectedResult: 'The hamburger menu drawer opens.' });
  push({ action: 'wait', durationMs: 1500, expectedResult: 'The drawer finishes opening.' });
  push({ action: 'click', targetLocator: HAMBURGER, optional: true, expectedResult: 'Retries the hamburger only if the drawer did not open — once open the button reads "Close", so this locator stops matching and the step is a no-op.' });
  push({ action: 'wait', durationMs: 1500, expectedResult: 'Any retried open animation finishes.' });
  push({ action: 'verify_element_exists', targetLocator: DRAWER_LIST, expectedResult: 'The drawer list is present, so the menu really is open before anything looks for a row in it.' });
}

// --- Log in ---
push({ action: 'verify_element_exists', targetLocator: RES('toolbarLogin'), expectedResult: `The ${R.label} app is logged out and the Log In button is present.`, screenshotLabel: 'Before login' });
push({ action: 'click', targetLocator: RES('toolbarLogin'), expectedResult: 'The login sheet opens.' });
push({ action: 'verify_element_exists', targetLocator: RES('loginMobileNumber'), expectedResult: 'The mobile number field is present.' });
push({ action: 'click', targetLocator: RES('loginMobileNumber'), expectedResult: 'The mobile number field gains focus.' });
push({ action: 'type', targetLocator: RES('loginMobileNumber'), value: CREDENTIAL.mobileNumber, expectedResult: 'The mobile number is entered (the dialing code is a separate label, so this field takes the local digits only).' });
push({ action: 'verify_element_exists', targetLocator: RES('passwordInput'), expectedResult: 'The password field is present.' });
push({ action: 'click', targetLocator: RES('passwordInput'), expectedResult: 'The password field gains focus.' });
push({ action: 'type', targetLocator: RES('passwordInput'), value: CREDENTIAL.password, expectedResult: 'The password is entered.' });
push({ action: 'verify_element_exists', targetLocator: RES('loginSignIn'), expectedResult: 'The Log In button is present.' });
push({ action: 'click', targetLocator: RES('loginSignIn'), expectedResult: 'The sign-in request is submitted.' });
push({ action: 'wait', durationMs: 3000, expectedResult: 'The sign-in request gets under way.' });

/**
 * Samsung Pass offers to save the credentials immediately after a successful sign-in. It is a
 * SYSTEM dialog covering the whole app, so everything after it fails in a way that looks unrelated
 * — it surfaced as "could not open the drawer", because the drawer was never reachable.
 *
 * Always Cancel, never Save: saving would write the test credentials into the device owner's
 * password manager. Matched by xpath rather than the resource-id strategy, because these ids belong
 * to the "android" package and that strategy prefixes a bare id with the app under test's package.
 */
const AUTOFILL_CANCEL = { strategy: 'xpath-text', value: '//*[@resource-id="android:id/autofill_save_no"]' };
for (let attempt = 0; attempt < 2; attempt += 1) {
  push({ action: 'click', targetLocator: AUTOFILL_CANCEL, optional: true, expectedResult: `Attempt ${attempt + 1} of 2: declines the system password-manager save prompt if it appeared; otherwise a no-op. Declined deliberately — the test must not store its credentials on the device.` });
  push({ action: 'wait', durationMs: 1000, expectedResult: 'The dialog finishes dismissing.' });
}

// Biometric enrolment appears on its own schedule on physical devices. Always Skip, never Allow.
for (let attempt = 0; attempt < 3; attempt += 1) {
  push({ action: 'click', targetLocator: RES('biometricSkip'), optional: true, expectedResult: `Attempt ${attempt + 1} of 3: dismisses the post-login Biometric Setup prompt via Skip if it has appeared; otherwise a no-op.` });
  push({ action: 'wait', durationMs: 2000, expectedResult: 'Gives the prompt time to appear, or to finish dismissing, before the next attempt.' });
}
for (let i = 0; i < 2; i += 1) {
  push({ action: 'click', targetLocator: MODAL_CLOSE, optional: true, expectedResult: 'Closes a post-login popup layer if one is present; otherwise a no-op.' });
  push({ action: 'wait', durationMs: 800, expectedResult: 'Any popup dismissal settles.' });
}
for (let i = 0; i < 3; i += 1) {
  push({ action: 'wait', durationMs: 3000, expectedResult: 'Further time for a slow sign-in to complete before the session is asserted.' });
}
push({ action: 'verify_element_exists', targetLocator: RES('toolbarDeposit'), expectedResult: 'The toolbar shows the logged-in Deposit control, confirming the account is signed in.', screenshotLabel: 'After login' });

// --- Open My Bets from the drawer ---
pushOpenDrawer();
if (R.expectLanguage) {
  push({ action: 'verify_text', targetLocator: RES(R.expectLanguage.id), value: R.expectLanguage.value, expectedResult: `The app language is "${R.expectLanguage.value}". Asserted because this build translates the drawer row labels that every locator below matches on — with the language set to Swahili the rows read "Akaunti Yangu" / "Mikeka Yangu" and none of them resolve. Failing here names the cause; failing later would not.`, screenshotLabel: 'Language precondition' });
}
if (!R.sectionExpandedByDefault) {
  push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(R.myBetsSection), optional: true, expectedResult: `The drawer scrolls until the ${R.myBetsSection} section header is rendered.` });
  push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
  push({ action: 'click', targetLocator: SECTION_HEADER(R.myBetsSection), expectedResult: `The ${R.myBetsSection} section expands.` });
  push({ action: 'wait', durationMs: 1500, expectedResult: 'The expand animation finishes.' });
}
push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(R.myBetsRow), optional: true, expectedResult: `The drawer scrolls until ${R.myBetsRow} is rendered, if it was not already visible.` });
push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
push({ action: 'verify_element_exists', targetLocator: SECTION_CHILD(R.myBetsRow), expectedResult: `The ${R.myBetsRow} row is visible in the drawer. Matched on its own navTitle id because "${R.myBetsRow}" also appears as the bottom-navigation label and as the page header — three nodes share that text, and only the drawer row carries navTitle.` });
push({ action: 'click', targetLocator: SECTION_CHILD(R.myBetsRow), expectedResult: 'Tapping the row opens the My Bets page.' });
// My Bets is a WebView, so give it room to render before asserting on its contents.
push({ action: 'wait', durationMs: 3500, expectedResult: 'The My Bets page finishes loading.' });

// --- Open Bets tab ---
push({ action: 'verify_element_exists', targetLocator: WEB_TEXT('Open Bets'), expectedResult: 'The My Bets page is open — the Open Bets tab label is a marker unique to this page (verified: exactly one node carries that text).' });
push({ action: 'click', targetLocator: WEB_TEXT('Open Bets'), expectedResult: 'The Open Bets tab is selected.' });
push({ action: 'wait', durationMs: 2500, expectedResult: "The Open Bets list finishes rendering (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Open Bets' });

// --- Settled Bets tab ---
push({ action: 'verify_element_exists', targetLocator: WEB_TEXT('Settled Bets'), expectedResult: 'The Settled Bets tab is available.' });
push({ action: 'click', targetLocator: WEB_TEXT('Settled Bets'), expectedResult: 'The Settled Bets tab is selected.' });
push({ action: 'wait', durationMs: 2500, expectedResult: "The Settled Bets list finishes rendering (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Settled Bets' });

// --- Close the page with the app's own X, never the system Back button ---
push({ action: 'wait', durationMs: 1200, expectedResult: 'Any popup the page raises has time to render before it is closed.' });
for (let i = 0; i < 3; i += 1) {
  push({ action: 'click', targetLocator: MODAL_CLOSE, optional: true, expectedResult: `Attempt ${i + 1} of 3: closes the topmost remaining layer — a popup if one is up, otherwise the My Bets page itself; a no-op once everything is closed.` });
  push({ action: 'wait', durationMs: 1000, expectedResult: 'The closed layer disappears and any layer beneath it becomes tappable.' });
}
push({ action: 'verify_element_exists', targetLocator: RES('toolbarDeposit'), expectedResult: 'Back on the main screen with the session still live, so the logout teardown has something to log out of.', screenshotLabel: 'Back on the main screen' });

const testCase = {
  testCaseId: R.testCaseId,
  screenId: R.screenId,
  title: `My Bets (${R.label}): open the Open Bets and Settled Bets tabs.`,
  description:
    `Logs in to the ${R.label} build (${PKG}), opens My Bets from the hamburger drawer, then switches between the ` +
    'Open Bets and Settled Bets tabs, capturing one screenshot of each as proof it rendered. Read-only: nothing is ' +
    'placed, cashed out or cancelled. ' +
    'The tab labels are WebView text with no resource-id — each verified to appear exactly once on this screen, and ' +
    'verified NOT to include the count badge that renders beside "Open Bets", which would have broken an exact-text ' +
    'match. The drawer row is matched on its navTitle id instead of its text, because "My Bets" also appears as the ' +
    'bottom-navigation label and the page header.',
  steps,
  priority: 'high',
  tags: ['manual', 'my-bets', 'login', REGION_KEY],
  appVersionName: R.appVersionName,
  appVersionCode: R.appVersionCode,
  sequence: 20,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(testCase, null, 2) + '\n');
console.log('Wrote', OUT_PATH);
console.log(
  `  region ${REGION_KEY} (${PKG}) — ${steps.length} steps, ` +
    `${steps.filter((s) => s.screenshotLabel).length} screenshots: ` +
    steps.filter((s) => s.screenshotLabel).map((s) => s.screenshotLabel).join(' | '),
);
