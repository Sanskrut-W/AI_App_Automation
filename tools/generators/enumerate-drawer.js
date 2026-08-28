/**
 * Logs in and enumerates every hamburger-drawer navigation item in on-screen order.
 *
 * The drawer list is virtualized, so a single page-source dump only shows the rows currently near
 * the viewport — this scrolls in small increments and unions what it sees, preserving first-seen
 * order, which is what you need to author a tour that visits every item.
 *
 * Usage: node enumerate-drawer.js <deviceSerial>
 */
const { remote } = require('c:\\Users\\SW115406\\Desktop\\AI_App_Automation\\node_modules\\webdriverio');

const DEVICE = process.argv[2];
if (!DEVICE) throw new Error('usage: node enumerate-drawer.js <deviceSerial>');

const PKG = 'com.betwayafrica.za';

/** Read from config rather than hardcoded, so real credentials live in one gitignored file. */
const ACCOUNT = (() => {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing ${configPath}. Copy config/test-accounts.example.json to config/test-accounts.json and fill in your test account.`,
    );
  }
  const account = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  if (!account?.mobileNumber || !account?.password) {
    throw new Error(`config/test-accounts.json has no mobileNumber/password for ${PKG}.`);
  }
  return { mobile: account.mobileNumber, password: account.password };
})();

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

/** All drawer row titles currently materialised, in document (i.e. visual) order. */
async function visibleNavTitles(driver) {
  const xml = await driver.getPageSource();
  const titles = [];
  const re = /resource-id="com\.betwayafrica\.za:id\/navTitle"[^>]*?text="([^"]*)"|text="([^"]*)"[^>]*?resource-id="com\.betwayafrica\.za:id\/navTitle"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = (m[1] ?? m[2] ?? '').trim();
    if (text) titles.push(text);
  }
  return titles;
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

    // Log in if we are not already signed in.
    if (await (await driver.$(`id=${PKG}:id/toolbarLogin`)).isExisting()) {
      console.log('logging in...');
      await (await driver.$(`id=${PKG}:id/toolbarLogin`)).click();
      await driver.pause(1200);
      await (await driver.$(`id=${PKG}:id/loginMobileNumber`)).setValue(ACCOUNT.mobile);
      await (await driver.$(`id=${PKG}:id/passwordInput`)).setValue(ACCOUNT.password);
      await (await driver.$(`id=${PKG}:id/loginSignIn`)).click();
      await driver.pause(4000);
      for (let i = 0; i < 3; i += 1) {
        await tapIfPresent(driver, `id=${PKG}:id/biometricSkip`, 'Biometric Setup');
        await tapIfPresent(driver, '//*[@resource-id="modal-close-btn"]', 'popup layer');
        await driver.pause(1500);
      }
    }
    console.log('logged in:', await (await driver.$(`id=${PKG}:id/toolbarDeposit`)).isExisting());

    // Open the drawer.
    let open = await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting();
    for (let attempt = 0; attempt < 3 && !open; attempt += 1) {
      await (await driver.$('~Open')).click();
      for (let waited = 0; waited < 6000 && !open; waited += 750) {
        await driver.pause(750);
        open = await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting();
      }
    }
    if (!open) throw new Error('could not open the drawer');

    const ordered = [];
    const seen = new Set();
    const record = (titles) => {
      for (const t of titles) {
        if (!seen.has(t)) {
          seen.add(t);
          ordered.push(t);
        }
      }
    };

    record(await visibleNavTitles(driver));
    // Scroll in small increments until nothing new appears for two consecutive passes.
    let dry = 0;
    for (let i = 0; i < 25 && dry < 2; i += 1) {
      const before = ordered.length;
      await driver.execute('mobile: dragGesture', {
        startX: 300, startY: 1780, endX: 300, endY: 1200, speed: 500,
      });
      await driver.pause(700);
      record(await visibleNavTitles(driver));
      dry = ordered.length === before ? dry + 1 : 0;
    }

    console.log(`\n=== ${ordered.length} drawer items, in order ===`);
    ordered.forEach((t, i) => console.log(String(i + 1).padStart(3) + '. ' + t));
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
