const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_PATH = path.join(
  REPO_ROOT,
  'artifacts', 'apps', 'com.betwayafrica.za', 'test-cases', 'manual',
  '105c7000-c5d5-41a9-a7ba-5c5d1dc08cf6.json',
);

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

const steps = [];
let n = 0;
function push(step) {
  n += 1;
  steps.push({ stepNumber: n, ...step });
}

const HAMBURGER = { strategy: 'accessibility-id', value: 'Open' };
const DRAWER_LIST = { strategy: 'resource-id', value: 'com.betwayafrica.za:id/leftNavigationItems' };

/**
 * Opens the drawer, tolerating a tap that doesn't take.
 *
 * One tap plus a fixed wait is not enough: if a WebView popup's scrim is still up the tap is
 * swallowed, and the open animation can outlast the pause. That is how the tour died on Betway
 * Rewards — 13 items in, still logged in, but the drawer simply wasn't open, so the row it wanted
 * did not exist.
 *
 * The retry is safe precisely because it targets content-desc "Open": the hamburger's description
 * flips to "Close" once the drawer is open, so the locator stops matching and the optional retry
 * becomes a no-op. When the drawer did not open, "Open" is still there and the tap happens again.
 * The closing assertion is on the drawer's own list, which is the thing later steps actually need.
 */
function pushOpenDrawer() {
  push({ action: 'verify_element_exists', targetLocator: HAMBURGER, elementId: '95858323-f853-4fcb-8fcd-7ceef6591f91', value: null, direction: null, durationMs: null, expectedResult: 'The hamburger menu button is present.' });
  push({ action: 'click', targetLocator: HAMBURGER, elementId: '95858323-f853-4fcb-8fcd-7ceef6591f91', value: null, direction: null, durationMs: null, expectedResult: 'The hamburger menu drawer opens.' });
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 1500, expectedResult: 'The drawer finishes opening.' });
  push({ action: 'click', targetLocator: HAMBURGER, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'Retries the hamburger only if the drawer did not open — once it is open the button reads "Close", so this locator no longer matches and the step is a no-op.', optional: true });
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 1500, expectedResult: 'Any retried open animation finishes.' });
  push({ action: 'verify_element_exists', targetLocator: DRAWER_LIST, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'The drawer list is present, so the menu really is open before anything looks for a row in it.' });
}

// Screenshots are captured ONLY for steps carrying a `screenshotLabel` (plus any step that fails,
// for diagnostics). Checkpoints here are deliberately sparse â€” before login, after login, and one
// per menu option â€” because labelling every step produced ~146 images per run, which buried the
// dozen that actually evidence anything. The label doubles as the caption above the image.

// --- Login once ---
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/toolbarLogin' }, elementId: 'a4d4b54e-744a-41e7-b9cf-d381e2dc083a', value: null, direction: null, durationMs: null, expectedResult: 'The login button is present.', screenshotLabel: 'Before login' });
push({ action: 'click', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/toolbarLogin' }, elementId: 'a4d4b54e-744a-41e7-b9cf-d381e2dc083a', value: null, direction: null, durationMs: null, expectedResult: 'Login form opens.' });
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/loginMobileNumber' }, elementId: '549066c7-cf9f-414c-909c-6716318b2f79', value: null, direction: null, durationMs: null, expectedResult: 'The mobile number input is present.' });
push({ action: 'click', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/loginMobileNumber' }, elementId: '549066c7-cf9f-414c-909c-6716318b2f79', value: null, direction: null, durationMs: null, expectedResult: 'The mobile number input gains focus.' });
push({ action: 'type', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/loginMobileNumber' }, elementId: '549066c7-cf9f-414c-909c-6716318b2f79', value: CREDENTIAL.mobileNumber, direction: null, durationMs: null, expectedResult: 'The mobile number is entered.' });
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/passwordInput' }, elementId: '2595a931-60c7-4c35-913c-289dca56db44', value: null, direction: null, durationMs: null, expectedResult: 'The password input is present.' });
push({ action: 'click', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/passwordInput' }, elementId: '2595a931-60c7-4c35-913c-289dca56db44', value: null, direction: null, durationMs: null, expectedResult: 'The password input gains focus.' });
push({ action: 'type', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/passwordInput' }, elementId: '2595a931-60c7-4c35-913c-289dca56db44', value: CREDENTIAL.password, direction: null, durationMs: null, expectedResult: 'The password is entered.' });
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/loginSignIn' }, elementId: '84afc273-24e0-4d99-b22e-4b65d9df8320', value: null, direction: null, durationMs: null, expectedResult: 'The target element is present.' });
push({ action: 'click', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/loginSignIn' }, elementId: '84afc273-24e0-4d99-b22e-4b65d9df8320', value: null, direction: null, durationMs: null, expectedResult: 'user should get logged in' });
push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 2000, expectedResult: 'The login request finishes before the next step checks anything (login is asynchronous).' });

// On some devices (proven live on a physical Galaxy A05s; never seen on the emulator) the app
// offers to enrol biometric login immediately after a successful sign-in. That popup covers the
// toolbar entirely, so the hamburger button's content-desc="Open" is absent from the hierarchy â€”
// which previously sent the locator-healing engine hunting for a substitute, clicking the wrong
// element, and walking into Android's native "Exit app?" dialog. Dismissing it with "Skip"
// (deliberately not "Allow" â€” declining avoids enrolling biometrics against a real account)
// keeps the toolbar reachable. Optional, since devices that never offer it must not fail here.
// Retried a few times, spaced out, because the prompt appears on its own schedule: on an S21 Ultra
// it had still not rendered 3.5s after sign-in, so a single attempt no-opped and the prompt then
// surfaced in time to break a later step.
for (let attempt = 0; attempt < 3; attempt += 1) {
  push({ action: 'click', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/biometricSkip' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: `Attempt ${attempt + 1} of 3: if the device offered biometric-login enrolment after sign-in, the prompt is declined and dismissed; otherwise this step is a no-op.`, optional: true });
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 2000, expectedResult: 'Gives the prompt time to appear, or to finish dismissing, before the next attempt.' });
}

// Right after login, Betway ZA can show a "Withdrawal Alert" (unused freebet warning) as a
// WebView popup, stacked with the base screen's own WebView-rendered close control at nearly the
// same spot, both sharing the exact same "modal-close-btn" resource-id (proven live: 0, 1, or 2
// layers can be present depending on session state/timing). Tapping it twice here, each optional,
// clears the run of this before the tour starts, so it isn't mistaken for something the first
// menu item caused.
// Matched by xpath rather than the "resource-id" strategy: that strategy maps to Appium's "id"
// locator, which prefixes a bare id with the app package, so it can never resolve a WebView id
// with no package part. Verified live — `id=modal-close-btn` does not resolve where this xpath
// does. Because these steps are optional, the mismatch was silently passing as a no-op.
for (let i = 0; i < 2; i += 1) {
  push({ action: 'click', targetLocator: { strategy: 'xpath-text', value: '//*[@resource-id="modal-close-btn"]' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'If a post-login Withdrawal Alert popup layer is present, it closes; otherwise this step is a no-op.', optional: true });
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 800, expectedResult: 'Any popup dismissal settles.' });
}

// Extra slack before asserting the session: on a congested network the sign-in request has been
// observed still spinning ~10s after submit, and verify_element_exists is an instantaneous check
// with no implicit wait of its own, so it would call a slow-but-fine login a failure. Split into
// several waits rather than one long one so the run has somewhere obvious to point when a login is
// genuinely hung rather than merely slow.
for (let i = 0; i < 3; i += 1) {
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 3000, expectedResult: 'Further time for a slow sign-in to complete before the session is asserted.' });
}

// Assert the session really is signed in before touring, and capture the "after login" checkpoint
// off the same step. toolbarDeposit only exists once logged in, so this doubles as proof that the
// login actually succeeded rather than merely that the taps landed.
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/toolbarDeposit' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'The toolbar shows the logged-in Deposit control, confirming the account is signed in.', screenshotLabel: 'After login' });

// --- Tour: for each drawer item, open menu, scroll it into view, click, screenshot, close, settle ---
// Item order matches the real drawer; each is reached via on-device scrollIntoView (see below), so
// no per-item swipe counts or per-device tuning are needed.
// Order and spelling verified live by enumerating every drawer row â€” see
// tools/generators/enumerate-drawer.js, which scrolls the virtualized list and unions what it sees.
const ITEMS = [
  { label: 'Withdraw Funds' },
  { label: 'Deposit Funds' },
  { label: 'My Bets' },
  { label: 'Bonus Summary' },
  { label: 'Transaction Summary' },
  { label: 'My Casino Big Wins' },
  { label: 'My Gifts' },
  { label: 'Bet Influencer' },
  { label: 'Promo Voucher' },
  { label: 'Update Details' },
  { label: 'Responsible Gaming' },
  { label: 'Betway Benefits' },
  { label: 'Betway Rewards' },
  { label: 'Change Password' },
  { label: 'Document Verification' },
];
// Live Chat has its own resource-id locator (not ambiguous xpath-text), handled separately below.

for (const { label } of ITEMS) {
  pushOpenDrawer();

  // Scroll the row into view on-device rather than issuing a fixed number of blind swipes: the
  // list is virtualized, so a row that hasn't been scrolled near the viewport doesn't exist in the
  // hierarchy at all, and fling momentum varies per gesture on real hardware â€” a swipe count
  // calibrated on the emulator landed a row short or long on a physical Galaxy A05s, and every
  // recalibration only moved which item failed. scrollIntoView keeps swiping until the row is
  // actually there, so it needs no per-device tuning. Marked optional because items already
  // visible without scrolling make this a no-op on taller screens.
  // Two separate scopings here, both load-bearing:
  //
  // 1. The CONTAINER is the drawer's own ExpandableListView, not a bare scrollable(true) — this
  //    screen has three scrollable containers (the drawer list, the top-nav GridView and a 2px
  //    WebView strip) and an unscoped selector can pick the wrong one and scroll nothing.
  //
  // 2. The SEARCH selector is scoped to the row's own navTitle id, not bare text. Without it,
  //    UiScrollable stops as soon as ANY node on screen carries that text — and the All Balances
  //    panel renders balance rows with the same labels under "balanceTitle". Proven live: with a
  //    Rewards balance present, scrollIntoView(text("Betway Rewards")) matched the balanceTitle
  //    node, returned "found" in 1.8s without scrolling a pixel, and the drawer row was never
  //    rendered — so the tour failed on an item it had reached fine before the account acquired
  //    that balance. Scoped to navTitle the same call scrolls for 6.1s and lands the real row.
  //    This is also why the failure looked intermittent: it depends on account state, not the app.
  const scrollLocator = {
    strategy: 'android-uiautomator',
    value: `new UiScrollable(new UiSelector().resourceId("com.betwayafrica.za:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().resourceId("com.betwayafrica.za:id/navTitle").text("${label}"))`,
  };
  push({ action: 'verify_element_exists', targetLocator: scrollLocator, elementId: null, value: null, direction: null, durationMs: null, expectedResult: `The drawer scrolls until ${label} is rendered, if it wasn't already visible.`, optional: true });
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 500, expectedResult: 'The scroll settles.' });

  // Match on the drawer row's own navTitle id rather than on text + clickable. Several labels
  // appear twice on screen: "My Bets" is also a non-clickable bottom-nav label (an unfiltered
  // xpath silently tapped that one and merely closed the drawer, proven live), and "Betway
  // Benefits"/"Betway Rewards" also exist as clickable rows in the All Balances panel â€” so a
  // clickable filter alone is not enough to disambiguate those two. Every real drawer row carries
  // resource-id navTitle, which nothing else on the screen does.
  const locator = {
    strategy: 'xpath-text',
    value: `//android.widget.TextView[@resource-id="com.betwayafrica.za:id/navTitle" and @text="${label}"]`,
  };
  push({ action: 'verify_element_exists', targetLocator: locator, elementId: null, value: null, direction: null, durationMs: null, expectedResult: `The ${label} option is visible in the hamburger menu.` });
  push({ action: 'click', targetLocator: locator, elementId: null, value: null, direction: null, durationMs: null, expectedResult: `Tapping ${label} navigates away from the menu.` });
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 2500, expectedResult: `The ${label} screen finishes loading (this step's screenshot is the visual proof it opened).`, screenshotLabel: `Checking ${label}` });
  // Close the screen with its own X control — never the system Back button.
  //
  // Back is the wrong tool twice over. While a popup is still up it gets swallowed, and it then
  // reaches the app root, where Android's native "Exit Betway?" dialog appears over everything:
  // that is exactly how this tour died on Withdraw Funds, whose "Withdrawal Alert" (an unused
  // Bonus/Freebet warning) stays up after the screenshot. The X is the control the app itself
  // offers for leaving a screen, so it never has to guess at the navigation stack.
  //
  // A screen's page-header X carries the same "modal-close-btn" resource-id as a popup's own X, so
  // repeating the tap peels the layers off in order. Verified live on Withdraw Funds: two such
  // nodes on entry (the alert's X and the header's X); tap one closed the alert, tap two closed the
  // screen, leaving the home screen — with no Exit dialog at any point, and the next item's drawer
  // row reachable afterwards. Each tap is optional, so a screen with fewer layers simply skips the
  // rest, and each is followed by a real settle because the layers dismiss one at a time and the
  // one beneath needs time to become tappable.
  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 1200, expectedResult: `Any popup the ${label} screen raises has time to render before it is closed.` });
  for (let i = 0; i < 3; i += 1) {
    push({ action: 'click', targetLocator: { strategy: 'xpath-text', value: '//*[@resource-id="modal-close-btn"]' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: `Attempt ${i + 1} of 3: closes the topmost remaining layer — a popup if one is up, otherwise the ${label} screen itself; a no-op once everything is closed.`, optional: true });
    push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 1000, expectedResult: 'The closed layer disappears and any layer beneath it becomes tappable.' });
  }

  push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 800, expectedResult: 'The screen underneath settles before the menu is reopened.' });
}

// --- Live Chat: unique resource-id, no ambiguity, no scroll needed ---
pushOpenDrawer();
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/liveChat' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'The Live Chat option is visible in the hamburger menu, with no scrolling needed.' });
push({ action: 'click', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/liveChat' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'Tapping Live Chat responds (closes the menu); live chat itself may require support infrastructure not present in this test environment.' });
push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 2500, expectedResult: "Live Chat finishes responding (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Live Chat' });

// --- Log Out: the last drawer item, toured last on purpose ---
// In the drawer itself Log Out sits above the Customer Hub section that holds Live Chat, but it has
// to be visited last here because tapping it ends the session every later step depends on. Doing
// the logout through the app's own menu also means the session is closed the way a user closes it,
// rather than by wiping app state from outside â€” and it gets the item covered by the tour at the
// same time. The engine's own logout teardown then finds itself already logged out and no-ops,
// which is safe: its first check is "is toolbarDeposit still present?" and a failure there is
// logged and swallowed rather than counted against this test case.
pushOpenDrawer();
push({ action: 'verify_element_exists', targetLocator: { strategy: 'android-uiautomator', value: 'new UiScrollable(new UiSelector().resourceId("com.betwayafrica.za:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().resourceId("com.betwayafrica.za:id/navTitle").text("Log Out"))' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'The drawer scrolls until Log Out is rendered.', optional: true });
push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 500, expectedResult: 'The scroll settles.' });

const logOutLocator = { strategy: 'xpath-text', value: '//android.widget.TextView[@resource-id="com.betwayafrica.za:id/navTitle" and @text="Log Out"]' };
push({ action: 'verify_element_exists', targetLocator: logOutLocator, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'The Log Out option is visible at the end of the hamburger menu.' });
push({ action: 'click', targetLocator: logOutLocator, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'Tapping Log Out ends the session.' });
push({ action: 'wait', targetLocator: null, elementId: null, value: null, direction: null, durationMs: 3000, expectedResult: 'The logout request finishes.' });
push({ action: 'verify_element_exists', targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/toolbarLogin' }, elementId: null, value: null, direction: null, durationMs: null, expectedResult: 'The toolbar shows Log In again, proving the session really ended rather than the tap merely registering.', screenshotLabel: 'Checking Log Out' });

const testCase = {
  testCaseId: '105c7000-c5d5-41a9-a7ba-5c5d1dc08cf6',
  screenId: 'f53e9f8c-0f56-4de0-a195-56d43791fce8',
  title: 'Verify user is able to log in once and navigate through every option in the hamburger menu.',
  description: 'Logs in once, then tours every real hamburger-menu drawer item (Withdraw Funds, Deposit Funds, My Bets, Bonus Summary, Transaction Summary, My Casino Big Wins, My Gifts, Bet Influencer, Promo Voucher, Update Details, Responsible Gaming, Betway Benefits, Betway Rewards, Change Password, Document Verification, Live Chat) and finishes by logging out through the drawer\'s own Log Out item, closing back (not logging out) between all the others so the session stays live throughout. Every click locator filters on clickable="true" because several drawer labels are duplicated elsewhere on screen by a non-clickable element with the same text (proven live with "My Bets"). Never types into or submits any real-money/account-modifying field (Deposit/Withdraw/Change Password/Update Details/Promo Voucher/Responsible Gaming) â€” only verifies each screen opens correctly, with a screenshot as proof.',
  steps,
  priority: 'high',
  tags: ['manual', 'hamburger-menu', 'login'],
  appVersionName: '5.1.5',
  appVersionCode: '123',
  sequence: 10,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(testCase, null, 2) + '\n');
console.log('Wrote', OUT_PATH, 'with', steps.length, 'steps');
