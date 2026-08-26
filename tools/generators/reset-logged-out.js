/**
 * Returns the Betway ZA app to a clean, logged-OUT state through the app's own UI.
 *
 * Note on reading drawer dumps while debugging: when logged OUT the drawer contains only the
 * Quick Links section (Promos, Unsubscribe, Betting Rules, …) — the whole "My Account" section
 * and its rows (Withdraw Funds … Log Out) simply do not exist. A dump showing only Quick Links
 * therefore means "not signed in", not "the list failed to scroll".
 *
 * Deliberately does NOT use `adb shell pm clear`: on Android 13+ that resets the
 * POST_NOTIFICATIONS grant, so the next launch shows the runtime notification permission dialog,
 * which then sits on top of the app and breaks the very test you were resetting for (proven live
 * on the S21 Ultra — it caused a login run to mis-heal and fail). `appops set ... ignore` does not
 * suppress that dialog either, because the permission goes back to "ask".
 *
 * Usage: node reset-logged-out.js <deviceSerial>
 */
const { remote } = require('c:\\Users\\SW115406\\Desktop\\AI_App_Automation\\node_modules\\webdriverio');

const DEVICE = process.argv[2];
if (!DEVICE) throw new Error('usage: node reset-logged-out.js <deviceSerial>');

const PKG = 'com.betwayafrica.za';
const SCROLL_INTO_VIEW = (text) =>
  `new UiScrollable(new UiSelector().resourceId("${PKG}:id/leftNavigationItems")).scrollIntoView(new UiSelector().text("${text}"))`;

async function tapIfPresent(driver, selector, label) {
  const el = await driver.$(selector);
  if (await el.isExisting()) {
    await el.click();
    console.log(`  dismissed: ${label}`);
    await driver.pause(1200);
    return true;
  }
  return false;
}

async function main() {
  const driver = await remote({
    hostname: 'localhost',
    port: 4723,
    path: '/',
    logLevel: 'silent',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:udid': DEVICE,
      'appium:appPackage': PKG,
      'appium:noReset': true,
      'appium:settings[enforceXPath1]': true,
      'appium:adbExecTimeout': 60000,
    },
  });

  try {
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(1500);

    // Clear whatever popups happen to be up, in a few passes since they surface on their own
    // schedule and can be stacked.
    for (let pass = 0; pass < 3; pass += 1) {
      await tapIfPresent(driver, `id=${PKG}:id/biometricSkip`, 'Biometric Setup');
      await tapIfPresent(driver, 'id=modal-close-btn', 'promo / alert popup');
      await tapIfPresent(driver, '//*[@text="Cancel"]', 'Exit Betway dialog');
      await driver.pause(800);
    }

    // Close a drawer left open by an earlier run BEFORE deciding whether we are signed in. While
    // the drawer is open the toolbar is not in the hierarchy at all, so toolbarLogin reads as
    // absent and the check below would conclude "logged in" and then hunt for a Log Out row that
    // does not exist when logged out. Prefer the toggle (its content-desc flips to "Close" while
    // open) over back(), which the app answers with its "Exit Betway?" confirmation instead.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!(await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting())) break;
      console.log('  closing a drawer left open by an earlier run');
      if (!(await tapIfPresent(driver, '~Close', 'drawer (via toggle)'))) {
        // Fall back to tapping the dimmed app area to the right of the drawer panel.
        const { width, height } = await driver.getWindowSize();
        await driver.execute('mobile: clickGesture', {
          x: Math.round(width * 0.93),
          y: Math.round(height * 0.5),
        });
        await driver.pause(1200);
      }
      await tapIfPresent(driver, '//*[@text="Cancel"]', 'Exit Betway dialog');
    }

    // An abandoned login sheet also hides the toolbar, which would again be misread as "logged in".
    // It is a modal that back() does not dismiss, and its "X" is not exposed as its own clickable
    // node — it is drawn inside the title bar's bounds — so tap the right-hand end of that title
    // bar. Derived from the element's own rect rather than hardcoded pixels so it survives a
    // different screen size.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!(await (await driver.$(`id=${PKG}:id/loginMobileNumber`)).isExisting())) break;
      console.log('  dismissing an open login sheet');
      const title = await driver.$(`id=${PKG}:id/loginMainTitle`);
      if (!(await title.isExisting())) break;
      const bounds = await title.getAttribute('bounds'); // "[left,top][right,bottom]"
      const m = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds || '');
      if (!m) break;
      const [left, top, right, bottom] = m.slice(1).map(Number);
      const height = bottom - top;
      await driver.execute('mobile: clickGesture', {
        x: Math.round(right - height * 0.5),
        y: Math.round(top + height / 2),
      });
      await driver.pause(1500);
    }

    if (await (await driver.$(`id=${PKG}:id/toolbarLogin`)).isExisting()) {
      console.log('already logged out.');
      return;
    }

    console.log('logged in - logging out via the drawer...');

    // Tapping the hamburger is not reliably a single action: if a WebView popup's scrim is still
    // up the tap is swallowed, and the drawer animation can outlast a fixed pause. So confirm the
    // drawer's own list actually materialised and retry the tap if it did not, rather than
    // assuming one click worked (proven live on the S21 Ultra, where a silently-swallowed tap made
    // the scrollIntoView below hunt for 20s in a drawer that was never open).
    // The hamburger's content-desc flips to "Close" once the drawer is open, so "~Open" simply
    // stops existing - check the drawer's list rather than the trigger to decide whether to tap.
    let drawerOpen = await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting();
    if (drawerOpen) console.log('  drawer was already open');
    for (let attempt = 1; attempt <= 3 && !drawerOpen; attempt += 1) {
      const hamburger = await driver.$('~Open');
      await hamburger.waitForExist({ timeout: 8000 });
      await hamburger.click();
      for (let waited = 0; waited < 6000; waited += 750) {
        await driver.pause(750);
        if (await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting()) {
          drawerOpen = true;
          break;
        }
      }
      console.log(`  drawer open after attempt ${attempt}: ${drawerOpen}`);
    }
    if (!drawerOpen) throw new Error('could not open the navigation drawer');

    // The drawer list is virtualized, so "Log Out" only exists once scrolled to. UiScrollable
    // keeps swiping on-device until it materialises - no per-device swipe calibration needed.
    // Scope the scroll to the drawer's own ExpandableListView: this screen has three scrollable
    // containers (the drawer list, the top-nav GridView, and a 2px WebView strip), and an
    // unscoped scrollable(true) can pick the wrong one.
    const logout = await driver.$(`android=${SCROLL_INTO_VIEW('Log Out')}`);
    await logout.waitForExist({ timeout: 25000 });
    await logout.click();
    await driver.pause(3000);

    for (let pass = 0; pass < 2; pass += 1) {
      await tapIfPresent(driver, 'id=modal-close-btn', 'post-logout popup');
      await driver.pause(600);
    }

    const loggedOut = await (await driver.$(`id=${PKG}:id/toolbarLogin`)).isExisting();
    console.log(loggedOut ? 'logged out OK.' : 'WARNING: toolbarLogin not visible - check the device.');
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
