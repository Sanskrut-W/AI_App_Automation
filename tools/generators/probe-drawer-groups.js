/**
 * Determines, definitively, which drawer rows belong to which group header.
 *
 * Why the obvious approaches don't work:
 *   - The hierarchy is FLAT. Every row, header or child, is a sibling under the ExpandableListView
 *     carrying resource-id "navTitle" — see dump-drawer-tree.js output. So membership cannot be
 *     read off the tree.
 *   - On-screen order doesn't settle it either: adjacent rows look identical, so where one group's
 *     children end and the next group's begin is invisible.
 *   - A single page-source dump only shows rows near the viewport (the list is virtualized), and
 *     the drawer remembers its scroll position between openings, so a naive dump can miss headers
 *     entirely.
 *
 * So membership is established by experiment: collapse every group until only the headers remain,
 * then expand exactly one and enumerate the whole list. Whatever appeared belongs to that group.
 *
 * Read-only apart from tapping group headers, which only expand/collapse the list. It never taps a
 * child row, so it cannot open a menu destination or reach a real-money screen.
 *
 * Usage: node probe-drawer-groups.js <deviceSerial> [--appium-port 4723] [--package <name>]
 */
const path = require('path');
const fs = require('fs');
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node probe-drawer-groups.js <deviceSerial> [--appium-port N]');
}
const portFlag = process.argv.indexOf('--appium-port');
const APPIUM_PORT = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4723;

// Which regional build to probe. Betway ships one codebase per region under a different package
// (com.betwayafrica.za, .gh, .ng, com.betway.bw, ...), and every resource-id is package-prefixed,
// so the package has to be a parameter rather than a constant.
const pkgFlag = process.argv.indexOf('--package');
const PKG = pkgFlag > -1 ? process.argv[pkgFlag + 1] : 'com.betwayafrica.za';
const NAV = `${PKG}:id/navTitle`;
const LIST = `${PKG}:id/leftNavigationItems`;
/** The three collapsible sections, as they read in the drawer. */
const GROUPS = ['My Account', 'Quick Links', 'Customer Hub'];

const ACCOUNT = (() => {
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  if (!fs.existsSync(configPath)) throw new Error(`Missing ${configPath}.`);
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  const mapped = entry?.deviceAccounts?.[DEVICE];
  const account = (mapped && entry.accounts?.[mapped]) || entry;
  if (!account?.mobileNumber || !account?.password) throw new Error('no usable account in config');
  return { mobile: account.mobileNumber, password: account.password, id: mapped || 'default' };
})();

function navTitlesIn(xml) {
  const out = [];
  const tagPattern = /<[^/!?][^>]*?\/?>/g;
  let tag;
  while ((tag = tagPattern.exec(xml)) !== null) {
    const t = tag[0];
    if (!t.includes(`resource-id="${NAV}"`)) continue;
    const m = /\stext="([^"]*)"/.exec(t);
    const text = m ? m[1].trim() : '';
    if (text) out.push(text);
  }
  return out;
}

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

async function scrollToTop(driver) {
  const el = await driver.$(
    `android=new UiScrollable(new UiSelector().resourceId("${LIST}")).scrollToBeginning(20)`,
  );
  try {
    await el.isExisting();
  } catch {
    /* scrollToBeginning returns the container; failures here are not meaningful */
  }
  await driver.pause(700);
}

/**
 * Every navTitle row in the list's CURRENT expand state, in first-seen order.
 * Scrolls from the top until two consecutive passes reveal nothing new.
 */
async function collectRows(driver) {
  await scrollToTop(driver);
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
  record(navTitlesIn(await driver.getPageSource()));
  let dry = 0;
  for (let i = 0; i < 25 && dry < 2; i += 1) {
    const before = ordered.length;
    await driver.execute('mobile: dragGesture', {
      startX: 300, startY: 1780, endX: 300, endY: 1150, speed: 600,
    });
    await driver.pause(650);
    record(navTitlesIn(await driver.getPageSource()));
    dry = ordered.length === before ? dry + 1 : 0;
  }
  return ordered;
}

async function tapHeader(driver, label) {
  await driver.$(
    `android=new UiScrollable(new UiSelector().resourceId("${LIST}")).setMaxSearchSwipes(15).scrollIntoView(new UiSelector().resourceId("${NAV}").text("${label}"))`,
  ).isExisting().catch(() => {});
  await driver.pause(500);
  const header = await driver.$(`//android.widget.TextView[@resource-id="${NAV}" and @text="${label}"]`);
  if (!(await header.isExisting())) return false;
  await header.click();
  await driver.pause(1500);
  return true;
}

/** Taps headers until only the group headers themselves remain in the list. */
async function collapseAll(driver) {
  for (let pass = 0; pass < 6; pass += 1) {
    const rows = await collectRows(driver);
    const extras = rows.filter((r) => !GROUPS.includes(r));
    console.log(`  collapse pass ${pass + 1}: ${rows.length} rows (${extras.length} non-header)`);
    if (extras.length === 0) return rows;

    let changed = false;
    for (const g of GROUPS) {
      const before = (await collectRows(driver)).length;
      if (!(await tapHeader(driver, g))) continue;
      const after = (await collectRows(driver)).length;
      if (after < before) {
        console.log(`    collapsed "${g}" (${before} -> ${after})`);
        changed = true;
      } else if (after > before) {
        // That tap expanded it; undo so this pass only ever reduces.
        await tapHeader(driver, g);
        console.log(`    "${g}" was already collapsed (left as-is)`);
      }
    }
    if (!changed) break;
  }
  return collectRows(driver);
}

async function main() {
  const driver = await remote({
    hostname: 'localhost',
    port: APPIUM_PORT,
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

  const result = {};
  try {
    console.log(`device ${DEVICE}, account "${ACCOUNT.id}", appium :${APPIUM_PORT}`);
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(1500);

    if (await (await driver.$(`id=${PKG}:id/toolbarLogin`)).isExisting()) {
      console.log('logging in...');
      // Clear any cold-start interstitial first, then retry the Log In tap while polling for the
      // form. A fixed pause is not enough: a promo popup swallows the first tap, and an unfamiliar
      // regional build may take several seconds to render the sheet.
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
          ready = await (await driver.$(`id=${PKG}:id/loginMobileNumber`)).isExisting();
        }
        if (!ready) console.log(`  login form not up yet (attempt ${attempt + 1})`);
      }
      if (!ready) throw new Error('the login form never appeared');
      await (await driver.$(`id=${PKG}:id/loginMobileNumber`)).setValue(ACCOUNT.mobile);
      await (await driver.$(`id=${PKG}:id/passwordInput`)).setValue(ACCOUNT.password);
      await (await driver.$(`id=${PKG}:id/loginSignIn`)).click();
      await driver.pause(4000);
      for (let i = 0; i < 3; i += 1) {
        await tapIfPresent(driver, `id=${PKG}:id/biometricSkip`, 'Biometric Setup');
        await tapIfPresent(driver, '//*[@resource-id="modal-close-btn"]', 'popup layer');
        await driver.pause(1500);
      }
    } else {
      console.log('already signed in.');
    }

    let open = await (await driver.$(`id=${LIST}`)).isExisting();
    for (let attempt = 0; attempt < 3 && !open; attempt += 1) {
      const burger = await driver.$('~Open');
      if (await burger.isExisting()) await burger.click();
      for (let waited = 0; waited < 6000 && !open; waited += 750) {
        await driver.pause(750);
        open = await (await driver.$(`id=${LIST}`)).isExisting();
      }
    }
    if (!open) throw new Error('could not open the drawer');

    console.log('\n=== baseline (drawer as found) ===');
    const baseline = await collectRows(driver);
    baseline.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r}`));

    console.log('\n=== collapsing every group ===');
    const collapsed = await collapseAll(driver);
    console.log('  collapsed state rows:', JSON.stringify(collapsed));

    for (const g of GROUPS) {
      console.log(`\n=== expanding ONLY "${g}" ===`);
      if (!(await tapHeader(driver, g))) {
        console.log(`  "${g}" header not found — skipping.`);
        result[g] = null;
        continue;
      }
      const rows = await collectRows(driver);
      const children = rows.filter((r) => !GROUPS.includes(r));
      result[g] = children;
      console.log(`  ${children.length} child row(s), in order:`);
      children.forEach((c, i) => console.log(`    ${String(i + 1).padStart(2)}. ${c}`));
      // Collapse it again so the next group is measured from the same clean state.
      await tapHeader(driver, g);
      await driver.pause(600);
    }

    console.log('\n\n================ RESULT ================');
    console.log(JSON.stringify(result, null, 2));
    const outDir = path.resolve(__dirname, '..', '..', 'artifacts', 'drawer-probe');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `groups-${DEVICE}-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ device: DEVICE, baseline, groups: result }, null, 2) + '\n');
    console.log('\nwrote', outPath);
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
