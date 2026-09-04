/**
 * Generates a hamburger-drawer tour for a NON-ZA Betway regional build.
 *
 * Betway ships one codebase per region under its own package (com.betwayafrica.za, .gh, .ng,
 * com.betway.bw, ...). The ZA tour cannot simply be pointed at another region, for four independent
 * reasons — all four established live against GH 4.0.6 vs ZA 5.1.6:
 *
 *   1. Every resource-id is package-prefixed, so `com.betwayafrica.za:id/navTitle` resolves nothing
 *      on the GH build.
 *   2. The drawer's ROWS differ, in name and in set. GH's My Account has 14 rows where ZA has 16:
 *      it drops "My Casino Big Wins" and "My Gifts", renames "Transaction Summary" to
 *      "Transaction History", and even differs in casing — "Deposit funds" / "Withdraw funds" /
 *      "Change password" against ZA's "Deposit Funds" / "Withdraw Funds" / "Change Password". Quick
 *      Links differs more: 7 rows against 9, sharing only Contact Us, How To and Betway Scores App.
 *   3. Some labels appear in TWO sections. GH lists "Responsible Gaming" under both My Account and
 *      Quick Links, and "How To" under both Quick Links and Customer Hub. That is safe here only
 *      because the drawer is an accordion — at most one section is expanded, so only one of the two
 *      is ever in the hierarchy. It would be genuinely ambiguous in a non-accordion drawer.
 *   4. Customer Hub actually has a row in GH ("How To"), where in ZA it appears to be empty.
 *
 * What DOES transfer unchanged: the login flow ids (toolbarLogin, loginMobileNumber, passwordInput,
 * loginSignIn — verified identical on GH, which shows a "+233" dialing code and so also takes 9
 * local digits), the drawer container/row ids (leftNavigationItems, navTitle, navContainerRow,
 * navIcon), the footer controls (liveChat, themeSelector, oddsSelector), the bare WebView
 * "modal-close-btn" close control, and the accordion behaviour itself.
 *
 * ZA deliberately keeps its own generator (generate-consolidated-hamburger-tour.js) rather than
 * being folded in here: that tour is verified at 484/484 steps and is not worth regressing for
 * tidiness. If a third region is added, unify then.
 *
 * Usage: node generate-regional-hamburger-tour.js --region gh
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Credentials are emitted as placeholders and resolved at execution time against the account
 * configured for the package being driven, so the generated JSON holds no password.
 */
const CREDENTIAL = {
  mobileNumber: '{{account.mobileNumber}}',
  password: '{{account.password}}',
};

const REGIONS = {
  gh: {
    pkg: 'com.betwayafrica.gh',
    label: 'Ghana',
    testCaseId: 'd7c41e58-9b3a-4f26-8c15-6e2b7a9f4d80',
    /**
     * No crawl has been run against this build, so this points at no stored screen. It only has to
     * be non-empty (TestCase validates that) and stable across regenerations. The practical effect
     * is that locator healing can find nothing to heal from — same as for every step in the ZA tour
     * that carries a null elementId.
     */
    screenId: 'b91f2a7c-4d68-4e13-9a25-7c3f8e6d1b04',
    appVersionName: '4.0.6',
    appVersionCode: '106',
    /**
     * Rows in the order the drawer lists them, established by expanding each section in isolation
     * and enumerating it (tools/generators/probe-drawer-groups.js).
     *
     * Log Out is excluded here and toured last, separately: tapping it ends the session every later
     * step depends on.
     *
     * "Bet Influencer" is listed once even though the GH build renders it TWICE in My Account
     * (confirmed in a hierarchy dump — positions 2 and 7). Touring it twice would prove nothing; the
     * locator matches the first occurrence.
     */
    sections: [
      {
        name: 'My Account',
        expandedByDefault: true,
        rows: [
          'Bet Influencer',
          'Deposit funds',
          'Withdraw funds',
          'My Bets',
          'Transaction History',
          'Betway Benefits',
          'Bonus Summary',
          'Betway Rewards',
          'Promo Voucher',
          'Update Details',
          'Responsible Gaming',
          'Document Verification',
          'Change password',
        ],
      },
      {
        name: 'Quick Links',
        expandedByDefault: false,
        // "Terms & Conditions" carries a literal ampersand. It appears as &amp; in a page-source
        // dump because that dump is XML; the on-device text — and so what an xpath must match — is
        // the bare "&".
        rows: [
          'Privacy Policy',
          'FAQs',
          'Terms & Conditions',
          'Contact Us',
          'Responsible Gaming',
          'How To',
          'Betway Scores App',
        ],
      },
      {
        name: 'Customer Hub',
        expandedByDefault: false,
        rows: ['How To'],
      },
    ],
    /** Footer control below the section list — a different element from any Quick Links row. */
    liveChatFooterId: 'liveChat',
    logOutRow: 'Log Out',
    logOutSection: 'My Account',
  },
};

const regionFlag = process.argv.indexOf('--region');
const REGION_KEY = regionFlag > -1 ? process.argv[regionFlag + 1] : null;
if (!REGION_KEY || !REGIONS[REGION_KEY]) {
  throw new Error(
    `usage: node generate-regional-hamburger-tour.js --region <${Object.keys(REGIONS).join('|')}>`,
  );
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
/** The screen/popup close control. A bare WebView id, so it needs xpath: the "resource-id" strategy
 *  maps to Appium's "id" locator, which prefixes a bare id with the app package. */
const MODAL_CLOSE = { strategy: 'xpath-text', value: '//*[@resource-id="modal-close-btn"]' };

/** A section header: a navTitle with NO navContainerRow ancestor. */
const SECTION_HEADER = (label) => ({
  strategy: 'xpath-text',
  value: `//android.widget.TextView[@resource-id="${NAV_TITLE}" and @text="${label}" and not(ancestor::*[@resource-id="${NAV_ROW}"])]`,
});
/** A row inside a section: a navTitle that DOES sit inside a navContainerRow. Exact opposite of the
 *  header locator — the two were checked against each other live on the ZA build. */
const SECTION_CHILD = (label) => ({
  strategy: 'xpath-text',
  value: `//*[@resource-id="${NAV_ROW}"]//android.widget.TextView[@resource-id="${NAV_TITLE}" and @text="${label}"]`,
});
const SCROLL_TO = (label) => ({
  strategy: 'android-uiautomator',
  value: `new UiScrollable(new UiSelector().resourceId("${PKG}:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().resourceId("${NAV_TITLE}").text("${label}"))`,
});

/**
 * Opens the drawer, tolerating a tap that doesn't take. The optional retry targets content-desc
 * "Open", which flips to "Close" once the drawer is open — so the retry is a no-op when the first
 * tap worked, and a real second attempt when it didn't.
 */
function pushOpenDrawer() {
  push({ action: 'verify_element_exists', targetLocator: HAMBURGER, expectedResult: 'The hamburger menu button is present.' });
  push({ action: 'click', targetLocator: HAMBURGER, expectedResult: 'The hamburger menu drawer opens.' });
  push({ action: 'wait', durationMs: 1500, expectedResult: 'The drawer finishes opening.' });
  push({ action: 'click', targetLocator: HAMBURGER, optional: true, expectedResult: 'Retries the hamburger only if the drawer did not open — once open the button reads "Close", so this locator stops matching and the step is a no-op.' });
  push({ action: 'wait', durationMs: 1500, expectedResult: 'Any retried open animation finishes.' });
  push({ action: 'verify_element_exists', targetLocator: DRAWER_LIST, expectedResult: 'The drawer list is present, so the menu really is open before anything looks for a row in it.' });
}

/** Closes a screen with the app's own X — never the system Back button, which reaches the app root
 *  and raises an "Exit?" dialog. Repeating the tap peels stacked layers off in order. */
function pushCloseLayers(label) {
  // Timings are deliberately generous. A screen's own X control is WebView-rendered and does not
  // exist in the hierarchy until the page has laid out — and how long that takes depends on host
  // load, not just the device. Proven live: with two devices driving one host concurrently, the
  // Change Password screen had still not rendered its X when all three taps below had fired (they
  // landed at roughly 3.7s, 4.7s and 5.7s after the screen opened), so the screen never closed and
  // the tour then asserted a hamburger that was also still mid-render. A probe found the same
  // control present at 5s on the same build, which is what rules out an app regression.
  push({ action: 'wait', durationMs: 2500, expectedResult: `Any popup the ${label} screen raises has time to render before it is closed.` });
  for (let i = 0; i < 3; i += 1) {
    push({ action: 'click', targetLocator: MODAL_CLOSE, optional: true, expectedResult: `Attempt ${i + 1} of 3: closes the topmost remaining layer — a popup if one is up, otherwise the ${label} screen itself; a no-op once everything is closed.` });
    push({ action: 'wait', durationMs: 1500, expectedResult: 'The closed layer disappears and any layer beneath it becomes tappable.' });
  }
  push({ action: 'wait', durationMs: 800, expectedResult: 'The screen underneath settles before the menu is reopened.' });
}

// --- Log in once ---
push({ action: 'verify_element_exists', targetLocator: RES('toolbarLogin'), expectedResult: `The ${R.label} app is logged out and the Log In button is present.`, screenshotLabel: 'Before login' });
push({ action: 'click', targetLocator: RES('toolbarLogin'), expectedResult: 'The login sheet opens.' });
push({ action: 'verify_element_exists', targetLocator: RES('loginMobileNumber'), expectedResult: 'The mobile number field is present.' });
push({ action: 'click', targetLocator: RES('loginMobileNumber'), expectedResult: 'The mobile number field gains focus.' });
// The dialing code is shown separately (a "+233" label on this build), so the field itself takes
// the 9 local digits only.
push({ action: 'type', targetLocator: RES('loginMobileNumber'), value: CREDENTIAL.mobileNumber, expectedResult: 'The mobile number is entered.' });
push({ action: 'verify_element_exists', targetLocator: RES('passwordInput'), expectedResult: 'The password field is present.' });
push({ action: 'click', targetLocator: RES('passwordInput'), expectedResult: 'The password field gains focus.' });
push({ action: 'type', targetLocator: RES('passwordInput'), value: CREDENTIAL.password, expectedResult: 'The password is entered.' });
push({ action: 'verify_element_exists', targetLocator: RES('loginSignIn'), expectedResult: 'The Log In button is present.' });
push({ action: 'click', targetLocator: RES('loginSignIn'), expectedResult: 'The sign-in request is submitted.' });
push({ action: 'wait', durationMs: 3000, expectedResult: 'The sign-in request gets under way.' });

// Biometric enrolment is offered on its own schedule on physical devices. Always Skip, never
// Allow — this is a real account and we do not enrol biometrics on it.
for (let attempt = 0; attempt < 3; attempt += 1) {
  push({ action: 'click', targetLocator: RES('biometricSkip'), optional: true, expectedResult: `Attempt ${attempt + 1} of 3: dismisses the post-login Biometric Setup prompt via Skip if it has appeared; otherwise a no-op.` });
  push({ action: 'wait', durationMs: 2000, expectedResult: 'Gives the prompt time to appear, or to finish dismissing, before the next attempt.' });
}
// A promo interstitial and/or alert can stack over the toolbar, both under the same bare WebView
// "modal-close-btn" id, with 0, 1 or 2 layers present.
for (let i = 0; i < 2; i += 1) {
  push({ action: 'click', targetLocator: MODAL_CLOSE, optional: true, expectedResult: 'Closes a post-login popup layer if one is present; otherwise a no-op.' });
  push({ action: 'wait', durationMs: 800, expectedResult: 'Any popup dismissal settles.' });
}
// verify_element_exists is instantaneous with no implicit wait, and sign-in has been seen still
// spinning ~10s after submit on a congested network, so give it real slack.
for (let i = 0; i < 3; i += 1) {
  push({ action: 'wait', durationMs: 3000, expectedResult: 'Further time for a slow sign-in to complete before the session is asserted.' });
}
push({ action: 'verify_element_exists', targetLocator: RES('toolbarDeposit'), expectedResult: 'The toolbar shows the logged-in Deposit control, confirming the account is signed in.', screenshotLabel: 'After login' });

/** Tours one section's rows: open drawer, expand the section if needed, then visit each row. */
function pushSection(section, isFirstSection) {
  const { name, expandedByDefault, rows } = section;

  pushOpenDrawer();

  if (!expandedByDefault) {
    // A section header tap always TOGGLES, and nothing in the accessibility tree records which
    // state a section is in (verified on the ZA build: the header node is byte-identical expanded
    // and collapsed — same id, text, bounds and flags, no chevron sibling). So a single tap is only
    // deterministic because the starting state is known: this drawer is an ACCORDION, and the
    // section expanded before this one has just been left expanded, which means this one is
    // collapsed. The hard assertion on the first row, below, proves the tap went the right way
    // rather than leaving nine confusing "row not found" failures further down.
    push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(name), optional: true, expectedResult: `The drawer scrolls until the ${name} section header is rendered, if it was not already visible.` });
    push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
    push({ action: 'verify_element_exists', targetLocator: SECTION_HEADER(name), expectedResult: `The ${name} section header is present. Matched as a header specifically — a navTitle with no navContainerRow ancestor — so it can never match a row of the same name.` });
    push({ action: 'click', targetLocator: SECTION_HEADER(name), expectedResult: `The ${name} section expands, revealing its ${rows.length} row(s).` });
    push({ action: 'wait', durationMs: 1500, expectedResult: 'The expand animation finishes.' });
    push({ action: 'verify_element_exists', targetLocator: DRAWER_LIST, expectedResult: 'The drawer is still open after the header tap, so the tap landed on the header rather than dismissing the drawer.' });
    // Expanding relayouts the whole list (the previous section's rows collapse), which moves the
    // scroll position; the list is virtualized, so a row outside the viewport is absent from the
    // hierarchy entirely rather than merely off-screen.
    push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(rows[0]), optional: true, expectedResult: `The drawer scrolls until the first ${name} row is rendered, if the relayout left it outside the viewport.` });
    push({ action: 'wait', durationMs: 600, expectedResult: 'The scroll settles.' });
    push({ action: 'verify_element_exists', targetLocator: SECTION_CHILD(rows[0]), expectedResult: `${rows[0]} is present, proving the tap expanded ${name} rather than collapsing it.`, screenshotLabel: `${name} expanded` });
  }

  rows.forEach((label, index) => {
    const isLastRowOfSection = index === rows.length - 1;
    push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(label), optional: true, expectedResult: `The drawer scrolls until ${label} is rendered, if it was not already visible.` });
    push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
    push({ action: 'verify_element_exists', targetLocator: SECTION_CHILD(label), expectedResult: `The ${label} option is visible in the ${name} section.` });
    push({ action: 'click', targetLocator: SECTION_CHILD(label), expectedResult: `Tapping ${label} opens it.` });
    push({ action: 'wait', durationMs: 2500, expectedResult: `${label} finishes loading (this step's screenshot is the visual proof it opened).`, screenshotLabel: `Checking ${label}` });
    pushCloseLayers(label);
    // Reopen for the NEXT row only. pushOpenDrawer asserts hard on content-desc "Open", which is
    // absent while the drawer is already open, so calling it after the last row would collide with
    // whatever opens the drawer next.
    if (!isLastRowOfSection) {
      pushOpenDrawer();
    }
  });
  void isFirstSection;
}

R.sections.forEach((section, index) => pushSection(section, index === 0));

// --- Live Chat: the drawer's own footer control, a different element from any section row ---
pushOpenDrawer();
push({ action: 'verify_element_exists', targetLocator: RES(R.liveChatFooterId), expectedResult: 'The Live Chat footer control is visible in the drawer, below the section list and needing no scrolling.' });
push({ action: 'click', targetLocator: RES(R.liveChatFooterId), expectedResult: 'Tapping Live Chat responds; live chat itself may require support infrastructure not present in this test environment.' });
push({ action: 'wait', durationMs: 2500, expectedResult: "Live Chat finishes responding (this step's screenshot is the visual proof).", screenshotLabel: 'Checking Live Chat' });

// --- Log Out, last, because it ends the session every earlier step depends on ---
pushOpenDrawer();
// The accordion collapsed My Account when a later section was expanded, and Log Out is one of its
// rows — so it has to be re-expanded first or the row does not exist in the hierarchy at all.
push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(R.logOutSection), optional: true, expectedResult: `The drawer scrolls until the ${R.logOutSection} section header is rendered.` });
push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
push({ action: 'verify_element_exists', targetLocator: SECTION_HEADER(R.logOutSection), expectedResult: `The ${R.logOutSection} section header is present.` });
push({ action: 'click', targetLocator: SECTION_HEADER(R.logOutSection), expectedResult: `The ${R.logOutSection} section expands again, bringing back the rows the accordion collapsed.` });
push({ action: 'wait', durationMs: 1500, expectedResult: 'The expand animation finishes.' });
push({ action: 'verify_element_exists', targetLocator: SCROLL_TO(R.logOutRow), optional: true, expectedResult: `The drawer scrolls until ${R.logOutRow} is rendered.` });
push({ action: 'wait', durationMs: 500, expectedResult: 'The scroll settles.' });
push({ action: 'verify_element_exists', targetLocator: SECTION_CHILD(R.logOutRow), expectedResult: `The ${R.logOutRow} option is visible.` });
push({ action: 'click', targetLocator: SECTION_CHILD(R.logOutRow), expectedResult: 'Tapping Log Out ends the session.' });
push({ action: 'wait', durationMs: 3000, expectedResult: 'The logout request finishes.' });
push({ action: 'verify_element_exists', targetLocator: RES('toolbarLogin'), expectedResult: 'The toolbar shows Log In again, proving the session really ended rather than the tap merely registering.', screenshotLabel: 'Checking Log Out' });

const rowCount = R.sections.reduce((sum, s) => sum + s.rows.length, 0);
const testCase = {
  testCaseId: R.testCaseId,
  screenId: R.screenId,
  title: `Verify user is able to log in once and navigate through every option in the ${R.label} hamburger menu.`,
  description:
    `Logs in to the ${R.label} build (${PKG}) once, tours all ${rowCount} rows across the drawer's ` +
    `${R.sections.map((s) => `${s.name} (${s.rows.length})`).join(', ')} sections plus the Live Chat footer control, ` +
    'and finishes by logging out through the drawer\'s own Log Out row. Each row is opened, screenshotted as ' +
    'proof it rendered, and closed with the app\'s own X control — never the system Back button, which reaches ' +
    'the app root and raises an "Exit?" dialog. ' +
    'The drawer is an accordion, so exactly one section is expanded at a time; that is also what makes the ' +
    'labels appearing in two sections ("Responsible Gaming" in My Account and Quick Links, "How To" in Quick ' +
    'Links and Customer Hub) unambiguous at runtime. My Account is re-expanded before Log Out, which is one of ' +
    'its rows. ' +
    'Never types into or submits any real-money or account-modifying field (Deposit funds, Withdraw funds, ' +
    'Change password, Update Details, Promo Voucher, Responsible Gaming, Document Verification) — those screens ' +
    'are opened and screenshotted only.',
  steps,
  priority: 'high',
  tags: ['manual', 'hamburger-menu', 'login', REGION_KEY],
  appVersionName: R.appVersionName,
  appVersionCode: R.appVersionCode,
  sequence: 10,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(testCase, null, 2) + '\n');
console.log('Wrote', OUT_PATH);
console.log(
  `  region ${REGION_KEY} (${PKG}) — ${steps.length} steps, ` +
    `${steps.filter((s) => s.screenshotLabel).length} screenshots, ${rowCount} drawer rows + Live Chat + Log Out`,
);
