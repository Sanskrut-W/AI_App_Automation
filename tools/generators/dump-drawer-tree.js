/**
 * Prints the hamburger drawer's node tree with nesting, so group→child membership can be read off
 * the hierarchy directly instead of inferred from on-screen order.
 *
 * Why this exists: the drawer is an ExpandableListView, and the flat "rows in visual order" view
 * that enumerate-drawer.js produces cannot tell you where one group's children end and the next
 * group's begin — adjacent rows look identical, they all carry resource-id "navTitle". The tree
 * shows the actual grouping. It also writes the raw page source next to the tree so a locator can
 * be checked against exactly what the device reported.
 *
 * Read-only: opens the drawer, optionally expands group headers, and dumps. Never opens a menu
 * destination, so it cannot reach a real-money screen.
 *
 * Usage: node dump-drawer-tree.js <deviceSerial> [--appium-port 4723] [--expand-all]
 */
const path = require('path');
const fs = require('fs');
const { DOMParser } = require(path.resolve(__dirname, '..', '..', 'node_modules', '@xmldom', 'xmldom'));
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node dump-drawer-tree.js <deviceSerial> [--appium-port N] [--expand-all]');
}
const portFlag = process.argv.indexOf('--appium-port');
const APPIUM_PORT = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4723;
const EXPAND_ALL = process.argv.includes('--expand-all');

// One codebase per region, each under its own package, every resource-id package-prefixed.
const pkgFlag = process.argv.indexOf('--package');
const PKG = pkgFlag > -1 ? process.argv[pkgFlag + 1] : 'com.betwayafrica.za';
const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'drawer-probe');

const ACCOUNT = (() => {
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  if (!fs.existsSync(configPath)) throw new Error(`Missing ${configPath}.`);
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  const mapped = entry?.deviceAccounts?.[DEVICE];
  const account = (mapped && entry.accounts?.[mapped]) || entry;
  if (!account?.mobileNumber || !account?.password) throw new Error('no usable account in config');
  return { mobile: account.mobileNumber, password: account.password, id: mapped || 'default' };
})();

/** Renders the subtree under the drawer list, one line per node, indented by depth. */
function renderTree(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const lines = [];

  const describe = (el) => {
    const a = (n) => el.getAttribute(n) || '';
    const id = a('resource-id').replace(`${PKG}:id/`, '');
    const text = a('text').trim();
    const desc = a('content-desc').trim();
    const cls = (a('class') || el.tagName).replace('android.widget.', '').replace('android.view.', '');
    const bits = [cls];
    if (id) bits.push(`#${id}`);
    if (text) bits.push(JSON.stringify(text));
    else if (desc) bits.push(`desc=${JSON.stringify(desc)}`);
    if (a('clickable') === 'true') bits.push('[clickable]');
    return bits.join(' ');
  };

  const walk = (el, depth) => {
    lines.push('  '.repeat(depth) + describe(el));
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1) walk(child, depth + 1);
    }
  };

  // Find the drawer list and render only its subtree — the rest of the screen is page content.
  const all = doc.getElementsByTagName('*');
  let drawer = null;
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i];
    if ((el.getAttribute('resource-id') || '').endsWith(':id/leftNavigationItems')) {
      drawer = el;
      break;
    }
  }
  if (!drawer) return '(leftNavigationItems not found — is the drawer open?)';
  walk(drawer, 0);
  return lines.join('\n');
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
    } else {
      console.log('already signed in.');
    }

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

    if (EXPAND_ALL) {
      // Expand every group header so the whole tree is materialised at once. Tapping a header that
      // is already expanded would collapse it, so each is only tapped when none of the rows below
      // it are present — checked by counting navTitle rows before and after.
      for (const label of ['My Account', 'Quick Links', 'Customer Hub']) {
        const countRows = async () =>
          (await driver.$$(`//android.widget.TextView[@resource-id="${PKG}:id/navTitle"]`)).length;
        const before = await countRows();
        const header = await driver.$(
          `//android.widget.TextView[@resource-id="${PKG}:id/navTitle" and @text="${label}"]`,
        );
        if (!(await header.isExisting())) {
          console.log(`  "${label}": header not present`);
          continue;
        }
        await header.click();
        await driver.pause(1400);
        const after = await countRows();
        if (after < before) {
          // That tap collapsed it — tap again to leave it expanded.
          const again = await driver.$(
            `//android.widget.TextView[@resource-id="${PKG}:id/navTitle" and @text="${label}"]`,
          );
          if (await again.isExisting()) {
            await again.click();
            await driver.pause(1400);
          }
          console.log(`  "${label}": was expanded, re-expanded (rows ${before} -> ${after} -> ${await countRows()})`);
        } else {
          console.log(`  "${label}": expanded (rows ${before} -> ${after})`);
        }
      }
    }

    const xml = await driver.getPageSource();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const stamp = Date.now();
    const xmlPath = path.join(OUT_DIR, `drawer-${DEVICE}-${stamp}.xml`);
    const treePath = path.join(OUT_DIR, `drawer-${DEVICE}-${stamp}.tree.txt`);
    const tree = renderTree(xml);
    fs.writeFileSync(xmlPath, xml, 'utf8');
    fs.writeFileSync(treePath, tree, 'utf8');

    console.log('\n=== drawer tree ===');
    console.log(tree);
    console.log(`\nwrote ${treePath}`);
    console.log(`wrote ${xmlPath}`);
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
