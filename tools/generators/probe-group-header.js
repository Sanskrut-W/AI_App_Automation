/**
 * Dumps the raw subtree of the drawer's group-header rows, in both collapsed and expanded state.
 *
 * The question this answers: is a group's expanded/collapsed state visible anywhere in the
 * accessibility tree? It matters because a test step cannot branch. Tapping a header always
 * TOGGLES it, so "make sure Quick Links is expanded" is only expressible if some attribute or child
 * node differs between the two states — then an optional step can target the collapsed-only form
 * and become a no-op when the group is already open (the same trick the hamburger uses, where
 * content-desc flips Open -> Close).
 *
 * If nothing differs, the tour cannot guarantee expansion and has to be structured around that.
 *
 * Read-only apart from tapping a group header. Never taps a child row.
 *
 * Usage: node probe-group-header.js <deviceSerial> [--appium-port 4723] [--group "Quick Links"]
 */
const path = require('path');
const fs = require('fs');
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node probe-group-header.js <deviceSerial> [--appium-port N] [--group L]');
}
const portFlag = process.argv.indexOf('--appium-port');
const APPIUM_PORT = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 4723;
const groupFlag = process.argv.indexOf('--group');
const GROUP = groupFlag > -1 ? process.argv[groupFlag + 1] : 'Quick Links';

const PKG = 'com.betwayafrica.za';
const NAV = `${PKG}:id/navTitle`;
const LIST = `${PKG}:id/leftNavigationItems`;

const ACCOUNT = (() => {
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  const mapped = entry?.deviceAccounts?.[DEVICE];
  const account = (mapped && entry.accounts?.[mapped]) || entry;
  return { mobile: account.mobileNumber, password: account.password, id: mapped || 'default' };
})();

/**
 * The full row subtree containing the given label, as raw tags one per line.
 * Walks outward from the label to the enclosing navContainerRow so sibling
 * indicator nodes (arrows, chevrons) are included.
 */
function rowSubtree(xml, label) {
  const labelAt = xml.indexOf(`text="${label}"`);
  if (labelAt === -1) return `(row "${label}" not present in this dump)`;
  const rowStart = xml.lastIndexOf('navContainerRow', labelAt);
  if (rowStart === -1) return `(no enclosing navContainerRow found for "${label}")`;
  const open = xml.lastIndexOf('<', rowStart);
  // Take a generous slice forward; rows are small and this is for eyeballing.
  const slice = xml.slice(open, labelAt + 1800);
  return slice.replace(/></g, '>\n<');
}

/** Compact one-line-per-node view, showing only the attributes that could encode state. */
function stateView(xml, label) {
  const raw = rowSubtree(xml, label);
  return raw
    .split('\n')
    .map((line) => {
      const a = (n) => {
        const m = new RegExp(`\\s${n}="([^"]*)"`).exec(line);
        return m ? m[1] : '';
      };
      const cls = a('class');
      if (!cls) return null;
      const bits = [cls.replace('android.widget.', '').replace('android.view.', '')];
      const id = a('resource-id').replace(`${PKG}:id/`, '');
      if (id) bits.push(`#${id}`);
      if (a('text')) bits.push(`text=${JSON.stringify(a('text'))}`);
      if (a('content-desc')) bits.push(`desc=${JSON.stringify(a('content-desc'))}`);
      for (const flag of ['selected', 'checked', 'checkable', 'clickable', 'focused', 'expanded']) {
        if (a(flag) === 'true') bits.push(flag);
      }
      bits.push(`bounds=${a('bounds')}`);
      return '  ' + bits.join(' ');
    })
    .filter(Boolean)
    .join('\n');
}

async function scrollToTop(driver) {
  await driver
    .$(`android=new UiScrollable(new UiSelector().resourceId("${LIST}")).scrollToBeginning(20)`)
    .isExisting()
    .catch(() => {});
  await driver.pause(700);
}

async function countRows(driver) {
  return (await driver.$$(`//android.widget.TextView[@resource-id="${NAV}"]`)).length;
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
    console.log(`device ${DEVICE}, account "${ACCOUNT.id}", group "${GROUP}"`);
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(1500);

    if (await (await driver.$(`id=${PKG}:id/toolbarLogin`)).isExisting()) {
      console.log('logging in...');
      await (await driver.$(`id=${PKG}:id/toolbarLogin`)).click();
      await driver.pause(1200);
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

    await scrollToTop(driver);
    const xmlA = await driver.getPageSource();
    const countA = await countRows(driver);
    console.log(`\n########## STATE A (as found) — ${countA} navTitle rows ##########`);
    console.log(stateView(xmlA, GROUP));

    // Toggle it.
    const header = await driver.$(`//android.widget.TextView[@resource-id="${NAV}" and @text="${GROUP}"]`);
    if (!(await header.isExisting())) throw new Error(`"${GROUP}" header not visible after scrolling to top`);
    await header.click();
    await driver.pause(1600);
    await scrollToTop(driver);
    const xmlB = await driver.getPageSource();
    const countB = await countRows(driver);
    console.log(`\n########## STATE B (after one tap) — ${countB} navTitle rows ##########`);
    console.log(stateView(xmlB, GROUP));

    console.log(
      `\n>>> tapping "${GROUP}" went ${countB > countA ? 'COLLAPSED -> EXPANDED' : countB < countA ? 'EXPANDED -> COLLAPSED' : 'no visible change'}`,
    );

    const outDir = path.resolve(__dirname, '..', '..', 'artifacts', 'drawer-probe');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = Date.now();
    fs.writeFileSync(path.join(outDir, `header-A-${stamp}.xml`), xmlA, 'utf8');
    fs.writeFileSync(path.join(outDir, `header-B-${stamp}.xml`), xmlB, 'utf8');
    console.log(`\nwrote header-A-${stamp}.xml / header-B-${stamp}.xml`);

    // Leave it as we found it.
    const again = await driver.$(`//android.widget.TextView[@resource-id="${NAV}" and @text="${GROUP}"]`);
    if (await again.isExisting()) {
      await again.click();
      await driver.pause(1200);
      console.log('restored the original expand state.');
    }
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
