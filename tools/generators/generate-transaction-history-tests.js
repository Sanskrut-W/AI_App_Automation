/**
 * Generates the Transaction History module's test cases.
 *
 * Reached from the hamburger drawer's "Transaction Summary" row — the screen it opens is titled
 * "Transaction History". Kept separate from the hamburger tour (which only proves each drawer item
 * opens) and from My Bets, and written as a list of case definitions sharing one login prelude so
 * further cases can be added by appending to CASES.
 *
 * Everything below the toolbar is a WebView. Locators and behaviour were established live against
 * a Galaxy S21 Ultra (see the notes on each locator builder) rather than guessed.
 *
 * Usage: node generate-transaction-history-tests.js
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'apps', 'com.betwayafrica.za', 'test-cases', 'manual');
const SCREEN_ID = 'f53e9f8c-0f56-4de0-a195-56d43791fce8';

/** The transaction to search for. A wager on the test account, visible in its history. */
const SEARCH_TXN_ID = '992381343';
/** What the search box shows when empty — the app's own placeholder, and how we assert it cleared. */
const SEARCH_PLACEHOLDER = 'Transaction ID';

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

/** A native Android view id, which the "resource-id" strategy prefixes with the app package. */
const RES = (id) => ({ strategy: 'resource-id', value: `com.betwayafrica.za:id/${id}` });
/**
 * A WebView-assigned resource-id, matched by xpath rather than the "resource-id" strategy.
 *
 * The "resource-id" strategy maps to Appium's "id" locator, which prefixes a bare id with the app
 * package — so it resolves "toolbarDeposit" but can never resolve a WebView id such as
 * "transaction-history-search-btn", whose real resource-id has no package part at all. Verified
 * live: `id=date` and `id=transaction-history-search-btn` both fail to resolve where the xpath
 * below succeeds.
 */
const WEB_ID = (id) => ({ strategy: 'xpath-text', value: `//*[@resource-id="${id}"]` });
/** Text inside the WebView. These nodes carry no resource-id and report clickable="false", but a
 *  tap on them is handled by the WebView anyway. */
const WEB_TEXT = (text) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@text="${text}"]`,
});
/** A drawer row, matched on its own navTitle id — several drawer labels are duplicated elsewhere
 *  on screen, and only navTitle is unique. */
const NAV_ROW = (label) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@resource-id="com.betwayafrica.za:id/navTitle" and @text="${label}"]`,
});
const DRAWER_SCROLL = (label) => ({
  strategy: 'android-uiautomator',
  value: `new UiScrollable(new UiSelector().resourceId("com.betwayafrica.za:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().resourceId("com.betwayafrica.za:id/navTitle").text("${label}"))`,
});

const SEARCH_BOX = WEB_ID('transaction-history-search-btn');
/** The filter tabs each carry a stable WebView id — a far better target than their labels, since
 *  "Deposits"/"Withdrawals" also read as "Deposit" elsewhere on the toolbar and bottom nav. */
const TAB = {
  All: WEB_ID('transaction-history-All-btn'),
  Sports: WEB_ID('transaction-history-sports-btn'),
  Deposits: WEB_ID('transaction-history-deposit-btn'),
  Withdrawals: WEB_ID('transaction-history-withdrawal-btn'),
};
const PAGE_TITLE = WEB_TEXT('Transaction History');
const EMPTY_STATE = WEB_TEXT('No transactions were found');

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
  // same WebView "modal-close-btn" id, with 0, 1 or 2 layers present.
  for (let i = 0; i < 2; i += 1) {
    push({ action: 'click', targetLocator: WEB_ID('modal-close-btn'), optional: true, expectedResult: 'Closes a post-login popup layer if one is present; otherwise a no-op.' });
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

/** Selects a filter tab and asserts the resulting list, capturing it as the proof screenshot. */
function pushTab(b, tab, assertion) {
  b.push({ action: 'verify_element_exists', targetLocator: TAB[tab], expectedResult: `The ${tab} filter tab is present.` });
  b.push({ action: 'click', targetLocator: TAB[tab], expectedResult: `The ${tab} filter tab is selected.` });
  b.push({ action: 'wait', durationMs: 4000, expectedResult: `The ${tab} transaction list is re-queried and rendered.` });
  b.push({ action: 'verify_element_exists', targetLocator: assertion.locator, expectedResult: assertion.expectedResult });
  b.push({ action: 'wait', durationMs: 600, expectedResult: `The ${tab} list settles (this step's screenshot is the visual proof).`, screenshotLabel: `Checking ${tab} tab` });
}

const CASES = [
  {
    testCaseId: 'a4f8d1e6-7c93-4b25-8e01-3f6b9d247c58',
    sequence: 30,
    title: 'Transaction History: search by transaction ID, clear the search, and filter by Sports, Deposits and Withdrawals.',
    description:
      'Logs in, opens Transaction History from the hamburger menu ("Transaction Summary" row), searches the transaction ' +
      'ID search box for ' + SEARCH_TXN_ID + ', clears the search, then selects the Sports, Deposits and Withdrawals ' +
      'filter tabs, capturing one screenshot of each state. Read-only: nothing is deposited, withdrawn or cancelled. ' +
      'Two honest limits on the assertions, both compensated for by the screenshots. (1) The search box reports an ' +
      'empty accessibility text while it holds typed digits (verified live), so the typed value itself cannot be ' +
      'asserted — the search is instead evidenced by the searched transaction being present after submitting, plus a ' +
      'screenshot showing the list narrowed to that single row. The clear IS hard-asserted, because an empty box ' +
      'reports the "' + SEARCH_PLACEHOLDER + '" placeholder. (2) Nothing in the accessibility tree marks which filter ' +
      'tab is active — the tab nodes are byte-identical between Deposits and Withdrawals — so each tab asserts its ' +
      'resulting list instead, and the screenshot shows which tab is highlighted. Note the Deposits and Withdrawals ' +
      'assertions encode that this test account has no deposit or withdrawal history; they will need revisiting if it ' +
      'ever does. The case selects the All tab before searching, because the page remembers the last filter tab used ' +
      'and does not reliably open on All — and this case itself leaves Withdrawals selected when it finishes.',
    build(b) {
      pushLogin(b);
      pushOpenDrawerItem(b, 'Transaction Summary');

      // The whole screen below the toolbar is a WebView, so give it room to render before asserting.
      b.push({ action: 'wait', durationMs: 4000, expectedResult: 'The Transaction History page finishes loading.' });
      b.push({ action: 'verify_element_exists', targetLocator: PAGE_TITLE, expectedResult: 'The Transaction History page is open — its title is a marker unique to this page. Deliberately not matched on "Transaction ID", which appears twice here (the search box placeholder and a column header).' });
      b.push({ action: 'verify_element_exists', targetLocator: SEARCH_BOX, expectedResult: 'The transaction ID search box has rendered.' });

      // The page remembers whichever filter tab was last used — across navigations and app
      // restarts — so it does not necessarily open on All. Proven live: a run inherited the
      // Withdrawals tab from an earlier session and the transaction-ID search then correctly
      // returned "No transactions were found", because it was searching within withdrawals only.
      // Select All explicitly so the search runs against the full history whatever state we
      // inherit, and so the tab sequence later in this case starts from a known point.
      b.push({ action: 'verify_element_exists', targetLocator: TAB.All, expectedResult: 'The All filter tab is present.' });
      b.push({ action: 'click', targetLocator: TAB.All, expectedResult: 'The All filter tab is selected, so any filter left over from a previous session is cleared.' });
      b.push({ action: 'wait', durationMs: 4000, expectedResult: 'The unfiltered transaction list is queried and rendered.' });
      b.push({ action: 'wait', durationMs: 600, expectedResult: "The page settles (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Transaction History' });

      // --- search by transaction ID ---
      b.push({ action: 'click', targetLocator: SEARCH_BOX, expectedResult: 'The search box gains focus and the keypad opens.' });
      b.push({ action: 'wait', durationMs: 800, expectedResult: 'The field takes focus.' });
      b.push({ action: 'type', targetLocator: SEARCH_BOX, value: SEARCH_TXN_ID, expectedResult: `The transaction ID ${SEARCH_TXN_ID} is entered. This field rejects the accessibility set-text call (it reports ACTION_SET_PROGRESS, as though it were a slider), so the driver falls back to focusing it and sending keystrokes.` });
      b.push({ action: 'wait', durationMs: 1200, expectedResult: 'The keystrokes land.' });
      // Typing alone filters nothing: the query only runs on the keypad's Go/Search key. Verified
      // live — the row count was unchanged after typing and dropped to one after this action.
      b.push({ action: 'press_ime_action', value: 'search', expectedResult: "The keypad's Search/Go key submits the query." });
      b.push({ action: 'wait', durationMs: 4000, expectedResult: 'The filtered results come back from the server.' });
      b.push({ action: 'verify_element_exists', targetLocator: WEB_TEXT(SEARCH_TXN_ID), expectedResult: `The search returned transaction ${SEARCH_TXN_ID}.` });
      b.push({ action: 'wait', durationMs: 600, expectedResult: "The results settle (this step's screenshot shows the list narrowed to the single searched transaction).", screenshotLabel: `Searching transaction ${SEARCH_TXN_ID}` });

      // --- clear the search ---
      b.push({ action: 'clear', targetLocator: SEARCH_BOX, expectedResult: 'The search box is emptied.' });
      b.push({ action: 'wait', durationMs: 1500, expectedResult: 'The field settles.' });
      b.push({ action: 'verify_text', targetLocator: SEARCH_BOX, value: SEARCH_PLACEHOLDER, expectedResult: `The search box is empty again — an empty box reports its "${SEARCH_PLACEHOLDER}" placeholder as its text, so this is a real check that the clear took effect and not merely that the step ran.` });
      // Clearing the box does not re-run the query, so the list stays filtered until it is
      // re-submitted; do that so the cleared state is genuinely unfiltered.
      b.push({ action: 'click', targetLocator: SEARCH_BOX, expectedResult: 'The now-empty search box regains focus for the IME action.' });
      b.push({ action: 'wait', durationMs: 800, expectedResult: 'The field takes focus.' });
      b.push({ action: 'press_ime_action', value: 'search', expectedResult: 'The empty query is submitted, restoring the unfiltered list.' });
      b.push({ action: 'wait', durationMs: 4000, expectedResult: 'The unfiltered results come back.' });
      b.push({ action: 'verify_element_exists', targetLocator: PAGE_TITLE, expectedResult: 'Still on Transaction History after clearing and re-querying.' });
      b.push({ action: 'wait', durationMs: 600, expectedResult: "The list settles (this step's screenshot shows the restored unfiltered list).", screenshotLabel: 'After clearing the search' });

      // --- filter tabs ---
      // Do not hide the keyboard between these: Appium's hideKeyboard presses Back on Android,
      // which navigates out of Transaction History entirely (observed live). The tabs sit above the
      // keypad and take taps with it open.
      pushTab(b, 'Sports', {
        locator: WEB_TEXT('Wager'),
        expectedResult: 'The Sports list rendered with wager rows in it — a non-empty result for this filter. Cannot also assert the casino rows are gone: there is no absence assertion, so the screenshot carries that.',
      });
      pushTab(b, 'Deposits', {
        locator: EMPTY_STATE,
        expectedResult: 'The Deposits filter returned the "No transactions were found" empty state, a real state change from the populated Sports list.',
      });
      pushTab(b, 'Withdrawals', {
        locator: EMPTY_STATE,
        expectedResult: 'The Withdrawals filter returned the "No transactions were found" empty state. This same text was already on screen under Deposits, so this step alone cannot prove the tab switched — the screenshot, showing Withdrawals highlighted, is what evidences it.',
      });
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
    tags: ['manual', 'transaction-history', 'login'],
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
