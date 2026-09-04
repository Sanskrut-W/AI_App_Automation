/**
 * Discovers the hamburger drawer's GROUP structure, and what each group reveals when expanded.
 *
 * enumerate-drawer.js records only rows carrying resource-id "navTitle", and never taps anything —
 * so it can only ever see the groups that happen to be expanded already. The drawer is an
 * ExpandableListView: a collapsed group's children are not in the hierarchy at all, exactly like
 * an unscrolled row in a virtualized list. This script tells the two kinds of row apart, expands
 * each group in turn, and reports what appeared as a result — which is what you need in order to
 * author a tour that covers a dropdown's contents.
 *
 * Read-only apart from tapping group headers, which only expand/collapse the list. It never opens
 * a menu destination, so it cannot reach a real-money screen.
 *
 * Usage: node enumerate-drawer-groups.js <deviceSerial> [--appium-port 4723]
 */
const path = require('path');
const fs = require('fs');
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node enumerate-drawer-groups.js <deviceSerial> [--appium-port 4723]');
}
const portFlag = process.argv.indexOf('--appium-port');
const APPIUM_PORT = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4723;

const PKG = 'com.betwayafrica.za';

/** Read from the gitignored config so no credential is ever written into a script or its output. */
const ACCOUNT = (() => {
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${configPath}. Copy config/test-accounts.example.json and fill it in.`);
  }
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  // Prefer the account bound to this device, so running this against a device whose own account is
  // signed in does not silently log it out and sign a different one in.
  const mapped = entry?.deviceAccounts?.[DEVICE];
  const account = (mapped && entry.accounts?.[mapped]) || entry;
  if (!account?.mobileNumber || !account?.password) {
    throw new Error(`config/test-accounts.json has no usable account for ${PKG} / ${DEVICE}.`);
  }
  return { mobile: account.mobileNumber, password: account.password, id: mapped || 'default' };
})();

/**
 * Every node in the page source that carries visible text, in document (visual) order.
 *
 * Attribute order in the dump is not guaranteed, so each attribute is read from the tag
 * independently rather than with one positional pattern.
 */
function parseRows(xml) {
  const rows = [];
  const tagPattern = /<[^/!?][^>]*?\/?>/g;
  let tag;
  while ((tag = tagPattern.exec(xml)) !== null) {
    const t = tag[0];
    const attr = (name) => {
      const m = new RegExp(`\\s${name}="([^"]*)"`).exec(t);
      return m ? m[1] : '';
    };
    const text = attr('text').trim();
    const desc = attr('content-desc').trim();
    if (!text && !desc) continue;
    rows.push({
      text,
      desc,
      resourceId: attr('resource-id').replace(`${PKG}:id/`, ''),
      className: attr('class').replace('android.widget.', ''),
      clickable: attr('clickable') === 'true',
      bounds: attr('bounds'),
    });
  }
  return rows;
}

/** Left edge of a "[x1,y1][x2,y2]" bounds string, used to tell drawer rows from page content. */
function leftEdge(bounds) {
  const m = /\[(-?\d+),/.exec(bounds || '');
  return m ? Number(m[1]) : Number.NaN;
}

function show(rows, label) {
  console.log(`\n--- ${label} (${rows.length} rows with text) ---`);
  for (const r of rows) {
    const id = r.resourceId ? r.resourceId : '·';
    console.log(
      '  ' +
        id.padEnd(24) +
        r.className.padEnd(16) +
        (r.clickable ? 'clickable ' : '          ') +
        JSON.stringify(r.text || `(desc) ${r.desc}`),
    );
  }
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

async function openDrawer(driver) {
  let open = await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting();
  for (let attempt = 0; attempt < 3 && !open; attempt += 1) {
    const burger = await driver.$('~Open');
    if (await burger.isExisting()) await burger.click();
    for (let waited = 0; waited < 6000 && !open; waited += 750) {
      await driver.pause(750);
      open = await (await driver.$(`id=${PKG}:id/leftNavigationItems`)).isExisting();
    }
  }
  if (!open) throw new Error('could not open the drawer');
}

/** Drawer rows only: inside the drawer's own list, which hugs the left edge. */
async function drawerRows(driver) {
  const rows = parseRows(await driver.getPageSource());
  return rows.filter((r) => {
    const x = leftEdge(r.bounds);
    return Number.isFinite(x) && x < 700;
  });
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

  try {
    console.log(`device ${DEVICE}, account "${ACCOUNT.id}", appium :${APPIUM_PORT}`);
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(1500);

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

    await openDrawer(driver);
    const initial = await drawerRows(driver);
    show(initial, 'drawer as it opens');

    // Distinct resource-ids seen in the drawer: this is what separates a group header from a child
    // row, and it is the thing worth knowing before authoring any locator against them.
    const idCounts = new Map();
    for (const r of initial) idCounts.set(r.resourceId || '·', (idCounts.get(r.resourceId || '·') ?? 0) + 1);
    console.log('\n--- resource-ids present in the drawer ---');
    for (const [id, count] of [...idCounts].sort((a, b) => b[1] - a[1])) {
      console.log('  ' + String(count).padStart(3) + '  ' + id);
    }

    // Try expanding each candidate group header and report what that revealed.
    const GROUPS = ['Quick Links', 'My Account'];
    for (const label of GROUPS) {
      console.log(`\n\n=========== expanding "${label}" ===========`);
      const before = await drawerRows(driver);
      const beforeTexts = new Set(before.map((r) => r.text));

      // Scroll it into view first — the drawer list is virtualized.
      const scroll = await driver.$(
        `android=new UiScrollable(new UiSelector().resourceId("${PKG}:id/leftNavigationItems")).setMaxSearchSwipes(12).scrollIntoView(new UiSelector().text("${label}"))`,
      );
      try {
        await scroll.isExisting();
      } catch (e) {
        console.log(`  (scroll for "${label}" failed: ${e.message.split('\n')[0]})`);
      }
      await driver.pause(600);

      const header = await driver.$(`//*[@text="${label}"]`);
      if (!(await header.isExisting())) {
        console.log(`  "${label}" is not present in this drawer.`);
        continue;
      }
      const headerRow = (await drawerRows(driver)).find((r) => r.text === label);
      console.log(
        `  header row: resource-id="${headerRow?.resourceId ?? '?'}" class="${headerRow?.className ?? '?'}" clickable=${headerRow?.clickable}`,
      );

      await header.click();
      await driver.pause(1500);

      const after = await drawerRows(driver);
      const revealed = after.filter((r) => !beforeTexts.has(r.text));
      show(after, `drawer after tapping "${label}"`);
      console.log(`\n  >>> ${revealed.length} row(s) newly revealed by "${label}":`);
      for (const r of revealed) {
        console.log(
          '      ' +
            (r.resourceId || '·').padEnd(24) +
            r.className.padEnd(16) +
            (r.clickable ? 'clickable ' : '          ') +
            JSON.stringify(r.text || `(desc) ${r.desc}`),
        );
      }

      // Scroll down through the now-expanded group so virtualized children also surface.
      const unioned = new Map(revealed.map((r) => [r.text, r]));
      for (let i = 0; i < 10; i += 1) {
        await driver.execute('mobile: dragGesture', {
          startX: 300, startY: 1780, endX: 300, endY: 1200, speed: 500,
        });
        await driver.pause(600);
        for (const r of await drawerRows(driver)) {
          if (!beforeTexts.has(r.text) && !unioned.has(r.text)) unioned.set(r.text, r);
        }
      }
      console.log(`\n  >>> after scrolling, ${unioned.size} row(s) attributable to "${label}":`);
      for (const r of unioned.values()) {
        console.log(
          '      ' +
            (r.resourceId || '·').padEnd(24) +
            r.className.padEnd(16) +
            (r.clickable ? 'clickable ' : '          ') +
            JSON.stringify(r.text || `(desc) ${r.desc}`),
        );
      }

      // Collapse it again so the next group starts from a comparable state.
      const headerAgain = await driver.$(`//*[@text="${label}"]`);
      if (await headerAgain.isExisting()) {
        await headerAgain.click();
        await driver.pause(1200);
      }
    }
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
