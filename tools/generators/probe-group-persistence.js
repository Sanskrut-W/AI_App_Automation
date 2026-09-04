/**
 * Answers one question: once a drawer group is expanded, does it STAY expanded after you open one
 * of its screens, close that screen, and reopen the drawer?
 *
 * Why it matters for authoring a tour: a test step cannot branch, and tapping a group header always
 * toggles it — nothing in the accessibility tree distinguishes expanded from collapsed (verified:
 * the header node is byte-identical in both states). So the tour must know, in advance, whether it
 * needs to tap the header once for the whole section or once per item. Guessing wrong is not a
 * graceful failure: tapping an already-expanded group collapses it, and every later item in that
 * section then fails to resolve.
 *
 * Read-only apart from expanding a group and opening one deliberately-informational screen
 * (Terms and Conditions). It never touches a real-money or account-modifying row.
 *
 * Usage: node probe-group-persistence.js <deviceSerial> [--appium-port 4723]
 */
const path = require('path');
const fs = require('fs');
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node probe-group-persistence.js <deviceSerial> [--appium-port N]');
}
const portFlag = process.argv.indexOf('--appium-port');
const APPIUM_PORT = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4723;

const PKG = 'com.betwayafrica.za';
const NAV = `${PKG}:id/navTitle`;
const ROW = `${PKG}:id/navContainerRow`;
const LIST = `${PKG}:id/leftNavigationItems`;
const GROUP = 'Quick Links';
/** Deliberately an informational page: no money, no account fields, no external app. */
const PROBE_CHILD = 'Terms and Conditions';

const ACCOUNT = (() => {
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  const mapped = entry?.deviceAccounts?.[DEVICE];
  const a = (mapped && entry.accounts?.[mapped]) || entry;
  return { mobile: a.mobileNumber, password: a.password, id: mapped || 'default' };
})();

/** Child rows only: a child sits inside navContainerRow, a group header does not. */
const childXPath = (label) =>
  `//*[@resource-id="${ROW}"]//android.widget.TextView[@resource-id="${NAV}" and @text="${label}"]`;
/** Header rows only: navTitle with no navContainerRow ancestor. */
const headerXPath = (label) =>
  `//android.widget.TextView[@resource-id="${NAV}" and @text="${label}" and not(ancestor::*[@resource-id="${ROW}"])]`;

async function present(driver, selector) {
  return (await driver.$(selector)).isExisting();
}

async function openDrawer(driver) {
  let open = await present(driver, `id=${LIST}`);
  for (let attempt = 0; attempt < 3 && !open; attempt += 1) {
    const burger = await driver.$('~Open');
    if (await burger.isExisting()) await burger.click();
    for (let waited = 0; waited < 6000 && !open; waited += 750) {
      await driver.pause(750);
      open = await present(driver, `id=${LIST}`);
    }
  }
  return open;
}

async function scrollTo(driver, label) {
  await driver
    .$(`android=new UiScrollable(new UiSelector().resourceId("${LIST}")).setMaxSearchSwipes(15).scrollIntoView(new UiSelector().resourceId("${NAV}").text("${label}"))`)
    .isExisting()
    .catch(() => {});
  await driver.pause(600);
}

async function main() {
  const driver = await remote({
    hostname: 'localhost', port: APPIUM_PORT, path: '/', logLevel: 'silent',
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
    console.log(`device ${DEVICE}, account "${ACCOUNT.id}"`);
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(1500);

    if (await present(driver, `id=${PKG}:id/toolbarLogin`)) {
      console.log('logging in...');
      // A cold start raises a promo interstitial that swallows the first tap on Log In, so clear any
      // popup layers first, then retry the tap while polling for the form. A fixed pause is not
      // enough — verified: a single tap plus a 20s poll still never saw the form.
      let ready = false;
      for (let attempt = 0; attempt < 4 && !ready; attempt += 1) {
        for (let layer = 0; layer < 2; layer += 1) {
          const x = await driver.$('//*[@resource-id="modal-close-btn"]');
          if (await x.isExisting()) {
            await x.click();
            console.log('  dismissed a popup layer');
            await driver.pause(1200);
          }
        }
        const loginBtn = await driver.$(`id=${PKG}:id/toolbarLogin`);
        if (await loginBtn.isExisting()) await loginBtn.click();
        for (let waited = 0; waited < 8000 && !ready; waited += 750) {
          await driver.pause(750);
          ready = await present(driver, `id=${PKG}:id/loginMobileNumber`);
        }
        if (!ready) console.log(`  login form not up yet (attempt ${attempt + 1})`);
      }
      if (!ready) throw new Error('the login form never appeared');
      await (await driver.$(`id=${PKG}:id/loginMobileNumber`)).setValue(ACCOUNT.mobile);
      await (await driver.$(`id=${PKG}:id/passwordInput`)).setValue(ACCOUNT.password);
      await (await driver.$(`id=${PKG}:id/loginSignIn`)).click();
      await driver.pause(5000);
      for (let i = 0; i < 3; i += 1) {
        const b = await driver.$(`id=${PKG}:id/biometricSkip`);
        if (await b.isExisting()) await b.click();
        const m = await driver.$('//*[@resource-id="modal-close-btn"]');
        if (await m.isExisting()) await m.click();
        await driver.pause(1500);
      }
    } else {
      console.log('already signed in.');
    }

    if (!(await openDrawer(driver))) throw new Error('could not open the drawer');

    // Confirm the header/child xpath discriminators actually work before relying on them.
    await scrollTo(driver, 'My Account');
    console.log('\n--- discriminator check (My Account is expanded by default) ---');
    console.log('  header xpath matches "My Account":      ', await present(driver, headerXPath('My Account')));
    console.log('  child  xpath matches "My Account":      ', await present(driver, childXPath('My Account')));
    console.log('  child  xpath matches "Withdraw Funds":  ', await present(driver, childXPath('Withdraw Funds')));
    console.log('  header xpath matches "Withdraw Funds":  ', await present(driver, headerXPath('Withdraw Funds')));

    // Expand Quick Links (collapsed by default on a cold start).
    await scrollTo(driver, GROUP);
    console.log(`\n--- expanding "${GROUP}" ---`);
    console.log('  child present BEFORE tap:', await present(driver, childXPath(PROBE_CHILD)));
    await (await driver.$(headerXPath(GROUP))).click();
    await driver.pause(1600);
    await scrollTo(driver, PROBE_CHILD);
    const afterExpand = await present(driver, childXPath(PROBE_CHILD));
    console.log('  child present AFTER tap: ', afterExpand);
    if (!afterExpand) throw new Error('the tap did not expand the group — the default state assumption is wrong');

    // Is this an ACCORDION? If expanding one section collapses the others, then "Log Out" — a child
    // of My Account — becomes unreachable after Quick Links is expanded, and any tour that expands
    // Quick Links before logging out is broken.
    await scrollTo(driver, 'Withdraw Funds');
    const myAccountStillOpen = await present(driver, childXPath('Withdraw Funds'));
    await scrollTo(driver, 'Log Out');
    const logOutStillThere = await present(driver, childXPath('Log Out'));
    console.log('\n--- accordion check, with Quick Links now expanded ---');
    console.log('  My Account child "Withdraw Funds" still present:', myAccountStillOpen);
    console.log('  My Account child "Log Out" still present:       ', logOutStillThere);
    console.log(
      myAccountStillOpen || logOutStillThere
        ? '  => NOT an accordion; sections expand independently.'
        : '  => ACCORDION: expanding Quick Links collapsed My Account. Log Out must be visited BEFORE expanding Quick Links, or re-expanded after.',
    );

    // Open the child screen, then close it with the app's own X control.
    console.log(`\n--- opening "${PROBE_CHILD}" then closing it with the X ---`);
    await (await driver.$(childXPath(PROBE_CHILD))).click();
    await driver.pause(3000);
    for (let i = 0; i < 3; i += 1) {
      const x = await driver.$('//*[@resource-id="modal-close-btn"]');
      if (await x.isExisting()) {
        await x.click();
        await driver.pause(1200);
      }
    }
    await driver.pause(800);

    // THE QUESTION: reopen the drawer — is the group still expanded?
    if (!(await openDrawer(driver))) throw new Error('could not reopen the drawer');
    await scrollTo(driver, PROBE_CHILD);
    const stillExpanded = await present(driver, childXPath(PROBE_CHILD));
    console.log('\n================ RESULT ================');
    console.log(`  "${GROUP}" still expanded after opening/closing a child screen: ${stillExpanded}`);
    console.log(
      stillExpanded
        ? '  => tap the header ONCE for the whole section; do NOT tap it per item.'
        : '  => the group collapses again; the tour must re-expand before each item.',
    );
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
