/**
 * Opens one drawer row and dumps the resulting screen's text nodes, so a test case for that screen
 * can be authored against what the device actually reports rather than what a screenshot suggests.
 *
 * The distinction matters. A screenshot shows "Open Bets" next to a count badge, but that could be
 * one node reading "Open Bets 1" or two nodes reading "Open Bets" and "1" — and an exact-match xpath
 * works in the second case and silently fails in the first. Only the hierarchy settles it.
 *
 * Read-only: logs in, opens the drawer, expands a section if asked, taps ONE row, and dumps. Pass a
 * row that is safe to open — it never types into or submits anything, but opening a real-money
 * screen is still best avoided.
 *
 * Usage:
 *   node probe-drawer-row-screen.js <deviceSerial> --package <name> --row "My Bets"
 *                                   [--section "Quick Links"] [--appium-port 4723]
 */
const path = require('path');
const fs = require('fs');
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node probe-drawer-row-screen.js <deviceSerial> --package <name> --row <label>');
}
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const PKG = flag('--package', 'com.betwayafrica.za');
const ROW = flag('--row', null);
const SECTION = flag('--section', null);
const APPIUM_PORT = Number(flag('--appium-port', '4723'));
if (!ROW) throw new Error('--row is required');

const NAV_TITLE = `${PKG}:id/navTitle`;
const NAV_ROW = `${PKG}:id/navContainerRow`;
const LIST = `${PKG}:id/leftNavigationItems`;
const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'drawer-probe');

const ACCOUNT = (() => {
  const configPath = path.resolve(__dirname, '..', '..', 'config', 'test-accounts.json');
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[PKG];
  if (!entry) throw new Error(`config/test-accounts.json has no entry for ${PKG}`);
  const mapped = entry.deviceAccounts?.[DEVICE];
  const a = (mapped && entry.accounts?.[mapped]) || entry;
  if (!a?.mobileNumber || !a?.password) throw new Error('no usable account in config');
  return { mobile: a.mobileNumber, password: a.password, id: mapped || 'default' };
})();

const childXPath = (label) =>
  `//*[@resource-id="${NAV_ROW}"]//android.widget.TextView[@resource-id="${NAV_TITLE}" and @text="${label}"]`;
const headerXPath = (label) =>
  `//android.widget.TextView[@resource-id="${NAV_TITLE}" and @text="${label}" and not(ancestor::*[@resource-id="${NAV_ROW}"])]`;

/** Every node carrying text or a content-desc, in document order. */
function textNodes(xml) {
  const out = [];
  const tagPattern = /<[^/!?][^>]*?\/?>/g;
  let tag;
  while ((tag = tagPattern.exec(xml)) !== null) {
    const t = tag[0];
    const a = (n) => {
      const m = new RegExp(`\\s${n}="([^"]*)"`).exec(t);
      return m ? m[1] : '';
    };
    const text = a('text').trim();
    const desc = a('content-desc').trim();
    if (!text && !desc) continue;
    const id = a('resource-id');
    out.push({
      text,
      desc,
      id: id.startsWith(`${PKG}:id/`) ? id.slice(`${PKG}:id/`.length) : id,
      cls: a('class').replace('android.widget.', '').replace('android.view.', ''),
      clickable: a('clickable') === 'true',
      bounds: a('bounds'),
    });
  }
  return out;
}

async function present(driver, sel) {
  return (await driver.$(sel)).isExisting();
}
async function scrollTo(driver, label) {
  // Rewind to the top first. UiScrollable.scrollIntoView searches FORWARD (downward) only, and the
  // drawer remembers its scroll position between openings — so a row that sits above wherever the
  // list was last left is unreachable without this. Observed on the TZ build, whose drawer was
  // parked at the bottom: the row existed and simply could not be scrolled to.
  await driver
    .$(`android=new UiScrollable(new UiSelector().resourceId("${LIST}")).scrollToBeginning(20)`)
    .isExisting()
    .catch(() => {});
  await driver.pause(500);
  await driver
    .$(`android=new UiScrollable(new UiSelector().resourceId("${LIST}")).setMaxSearchSwipes(15).scrollIntoView(new UiSelector().resourceId("${NAV_TITLE}").text("${label}"))`)
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
    console.log(`device ${DEVICE}, package ${PKG}, account "${ACCOUNT.id}", row "${ROW}"`);
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(2500);

    if (await present(driver, `id=${PKG}:id/toolbarLogin`)) {
      console.log('logging in...');
      let ready = false;
      for (let attempt = 0; attempt < 4 && !ready; attempt += 1) {
        // Only dismiss a popup if the Log In control is actually BLOCKED, i.e. absent. Tapping
        // "modal-close-btn" unconditionally is not free: on some builds the home screen carries one
        // that is page furniture rather than a popup, and tapping it navigates away, after which
        // there is no Log In control left to tap and the form can never appear.
        if (!(await present(driver, `id=${PKG}:id/toolbarLogin`))) {
          const x = await driver.$('//*[@resource-id="modal-close-btn"]');
          if (await x.isExisting()) {
            await x.click();
            console.log('  dismissed a popup that was covering the toolbar');
            await driver.pause(1200);
          }
        }
        const btn = await driver.$(`id=${PKG}:id/toolbarLogin`);
        if (await btn.isExisting()) {
          // Deliberately not gated on clickable="true": some builds report this control as
          // clickable="false" and Appium taps the centre regardless.
          await btn.click();
        } else {
          console.log(`  no toolbarLogin on screen (attempt ${attempt + 1})`);
        }
        for (let waited = 0; waited < 10000 && !ready; waited += 750) {
          await driver.pause(750);
          ready = await present(driver, `id=${PKG}:id/loginMobileNumber`);
        }
        if (!ready) console.log(`  login form not up yet (attempt ${attempt + 1})`);
      }
      if (!ready && (await present(driver, `id=${PKG}:id/toolbarDeposit`))) {
        // Not a failure: this build restores its previous session ASYNCHRONOUSLY. There is a window
        // right after launch where the logged-out toolbar is still on screen, so the login branch is
        // entered, and by the time the tap lands the session has restored and the Log In control has
        // gone — leaving nothing to open a form. toolbarDeposit only exists when signed in, so its
        // presence means we are already where the login was trying to get to. Observed on the TZ
        // build, whose session also survives a force-stop.
        console.log('  already signed in after all (the session restored mid-login) — continuing');
        ready = true;
      }
      if (!ready) {
        // Say what IS on screen, so the next step is a fix rather than another guess.
        const stuck = textNodes(await driver.getPageSource());
        console.error('the login form never appeared. On screen instead:');
        for (const nd of stuck.slice(0, 25)) {
          console.error(`    ${nd.cls} ${nd.id || '·'} text=${JSON.stringify(nd.text)} desc=${JSON.stringify(nd.desc)}`);
        }
        throw new Error('the login form never appeared');
      }
      if (await present(driver, `id=${PKG}:id/loginMobileNumber`)) {
        await (await driver.$(`id=${PKG}:id/loginMobileNumber`)).setValue(ACCOUNT.mobile);
        await (await driver.$(`id=${PKG}:id/passwordInput`)).setValue(ACCOUNT.password);
        await (await driver.$(`id=${PKG}:id/loginSignIn`)).click();
        await driver.pause(6000);
      }
      for (let i = 0; i < 3; i += 1) {
        // Samsung Pass offers to save the credentials right after a successful sign-in, as a SYSTEM
        // dialog that covers the whole app — which silently breaks everything after it (observed as
        // "could not open the drawer", because the drawer was never reachable). Always Cancel, never
        // Save: saving would write the test credentials into the device owner's password manager.
        //
        // Matched by xpath, not the id strategy: these ids belong to the "android" package, and the
        // id strategy prefixes a bare id with the app under test's package.
        const autofillCancel = await driver.$('//*[@resource-id="android:id/autofill_save_no"]');
        if (await autofillCancel.isExisting()) {
          await autofillCancel.click();
          console.log('  dismissed the Samsung Pass save-password dialog (Cancel)');
          await driver.pause(1200);
        }
        const b = await driver.$(`id=${PKG}:id/biometricSkip`);
        if (await b.isExisting()) await b.click();
        const m = await driver.$('//*[@resource-id="modal-close-btn"]');
        if (await m.isExisting()) await m.click();
        await driver.pause(1500);
      }
    } else {
      console.log('already signed in.');
    }

    let open = await present(driver, `id=${LIST}`);
    for (let attempt = 0; attempt < 3 && !open; attempt += 1) {
      const burger = await driver.$('~Open');
      if (await burger.isExisting()) await burger.click();
      for (let waited = 0; waited < 6000 && !open; waited += 750) {
        await driver.pause(750);
        open = await present(driver, `id=${LIST}`);
      }
    }
    if (!open) throw new Error('could not open the drawer');

    if (SECTION) {
      await scrollTo(driver, SECTION);
      const header = await driver.$(headerXPath(SECTION));
      if (await header.isExisting()) {
        await header.click();
        await driver.pause(1600);
        console.log(`expanded section "${SECTION}"`);
      }
    }

    await scrollTo(driver, ROW);
    let row = await driver.$(childXPath(ROW));
    if (!(await row.isExisting())) {
      // Report the RAW text of every row actually present, byte for byte. A label that looks right
      // in a trimmed listing can still fail an exact-text xpath because of leading/trailing
      // whitespace, a non-breaking space, or a different apostrophe — none of which are visible in
      // ordinary output. Then retry with a contains() match so the probe still gets its dump.
      const xml = await driver.getPageSource();
      const raws = [];
      const tp = /<[^/!?][^>]*?\/?>/g;
      let t;
      while ((t = tp.exec(xml)) !== null) {
        if (!t[0].includes(`resource-id="${NAV_TITLE}"`)) continue;
        const g = /\stext="([^"]*)"/.exec(t[0]);
        if (g) raws.push(g[1]);
      }
      console.error(`row "${ROW}" did not match exactly. Rows present, raw:`);
      for (const r of raws) console.error('    ' + JSON.stringify(r));
      const loose = `//*[@resource-id="${NAV_ROW}"]//android.widget.TextView[@resource-id="${NAV_TITLE}" and contains(@text, "${ROW}")]`;
      row = await driver.$(loose);
      if (!(await row.isExisting())) throw new Error(`row "${ROW}" not found in the drawer (exact and contains both failed)`);
      console.error('  a contains() match DID resolve — continuing with that.');
    }
    await row.click();
    console.log(`tapped "${ROW}", waiting for the screen to render...`);
    await driver.pause(5000);

    const xml = await driver.getPageSource();
    const nodes = textNodes(xml);
    console.log(`\n--- "${ROW}" screen: ${nodes.length} nodes with text/desc ---`);
    for (const nd of nodes) {
      const bits = [nd.cls.padEnd(13), (nd.id || '·').padEnd(22)];
      if (nd.text) bits.push(`text=${JSON.stringify(nd.text)}`);
      if (nd.desc) bits.push(`desc=${JSON.stringify(nd.desc)}`);
      if (nd.clickable) bits.push('[clickable]');
      console.log('  ' + bits.join(' '));
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const safe = ROW.replace(/[^A-Za-z0-9]+/g, '-');
    const out = path.join(OUT_DIR, `screen-${PKG}-${safe}-${Date.now()}.xml`);
    fs.writeFileSync(out, xml, 'utf8');
    console.log(`\nwrote ${path.basename(out)}`);
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
