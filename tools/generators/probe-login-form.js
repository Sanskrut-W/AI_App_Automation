/**
 * Dumps a regional Betway build's home screen and login sheet, listing every identifiable node, so
 * the ids one build uses can be mapped onto another's.
 *
 * Why: Betway ships one codebase per region under its own package, and the tour's locators are all
 * package-prefixed resource-ids taken from the ZA build. That only transfers to another region if
 * the two builds share the same ids — which cannot be assumed across a major version gap (ZA 5.1.6
 * vs GH 4.0.6). Verified the hard way: pointing the ZA login ids at GH found "toolbarLogin" but
 * never "loginMobileNumber".
 *
 * Read-only. It taps at most the Log In control and popup close buttons; it never types a
 * credential, never submits a form, and never opens a menu destination.
 *
 * Usage: node probe-login-form.js <deviceSerial> --package <name> [--appium-port 4723]
 */
const path = require('path');
const fs = require('fs');
const { remote } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'webdriverio'));

const DEVICE = process.argv[2];
if (!DEVICE || DEVICE.startsWith('--')) {
  throw new Error('usage: node probe-login-form.js <deviceSerial> --package <name> [--appium-port N]');
}
const flag = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const PKG = flag('--package', 'com.betwayafrica.za');
const APPIUM_PORT = Number(flag('--appium-port', '4723'));
const OUT_DIR = path.resolve(__dirname, '..', '..', 'artifacts', 'drawer-probe');

/** Every node with a resource-id, text, or content-desc, in document order. */
function nodes(xml) {
  const out = [];
  const tagPattern = /<[^/!?][^>]*?\/?>/g;
  let tag;
  while ((tag = tagPattern.exec(xml)) !== null) {
    const t = tag[0];
    const a = (n) => {
      const m = new RegExp(`\\s${n}="([^"]*)"`).exec(t);
      return m ? m[1] : '';
    };
    const id = a('resource-id');
    const text = a('text').trim();
    const desc = a('content-desc').trim();
    if (!id && !text && !desc) continue;
    out.push({
      id: id.startsWith(`${PKG}:id/`) ? id.slice(`${PKG}:id/`.length) : id,
      text,
      desc,
      cls: a('class').replace('android.widget.', '').replace('android.view.', ''),
      clickable: a('clickable') === 'true',
      isPassword: a('password') === 'true',
      bounds: a('bounds'),
    });
  }
  return out;
}

function show(list, label) {
  console.log(`\n--- ${label} (${list.length} identifiable nodes) ---`);
  for (const n of list) {
    const bits = [n.cls.padEnd(14)];
    bits.push((n.id || '·').padEnd(26));
    if (n.text) bits.push(`text=${JSON.stringify(n.text.slice(0, 34))}`);
    if (n.desc) bits.push(`desc=${JSON.stringify(n.desc.slice(0, 34))}`);
    if (n.clickable) bits.push('[clickable]');
    if (n.isPassword) bits.push('[password]');
    console.log('  ' + bits.join(' '));
  }
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
    console.log(`device ${DEVICE}, package ${PKG}, appium :${APPIUM_PORT}`);
    await driver.execute('mobile: activateApp', { appId: PKG });
    await driver.pause(3000);

    // Clear whatever a cold start put on top.
    for (let i = 0; i < 3; i += 1) {
      const x = await driver.$('//*[@resource-id="modal-close-btn"]');
      if (await x.isExisting()) {
        await x.click();
        console.log('  dismissed a popup layer (modal-close-btn)');
        await driver.pause(1200);
      }
    }

    const homeXml = await driver.getPageSource();
    const home = nodes(homeXml);
    show(home, 'HOME screen');

    // Anything that looks like a way into signing in.
    console.log('\n--- login-ish candidates on the home screen ---');
    for (const n of home) {
      if (/login|log in|signin|sign in/i.test(`${n.id} ${n.text} ${n.desc}`)) {
        console.log(`  id="${n.id}" text=${JSON.stringify(n.text)} desc=${JSON.stringify(n.desc)} clickable=${n.clickable} bounds=${n.bounds}`);
      }
    }

    // Tap the most likely one and dump what appears.
    // Deliberately does NOT require clickable="true". Some regional builds report the toolbar's
    // Log In control as clickable="false" (verified on com.betway.ng 1.1.9, where ZA and GH both
    // report true), and Appium taps an element's centre regardless — the same thing that makes the
    // WebView text nodes tappable. Filtering on clickable here would hide the control entirely.
    const candidate =
      home.find((n) => /^toolbarLogin$/i.test(n.id)) ||
      home.find((n) => n.clickable && /login|log in|sign in/i.test(`${n.id} ${n.text} ${n.desc}`)) ||
      home.find((n) => /login|log in|sign in/i.test(`${n.id} ${n.text} ${n.desc}`));

    if (!candidate) {
      console.log('\n(no login control found on the home screen — is the app already signed in?)');
    } else {
      console.log(`\ntapping login control: id="${candidate.id}" text=${JSON.stringify(candidate.text)}`);
      const el = candidate.id
        ? await driver.$(`id=${PKG}:id/${candidate.id}`)
        : await driver.$(`//*[@text="${candidate.text}"]`);
      await el.click();
      await driver.pause(4000);

      const loginXml = await driver.getPageSource();
      const login = nodes(loginXml);
      show(login, 'after tapping the login control');

      console.log('\n--- input fields present ---');
      for (const n of login) {
        if (/EditText|AutoCompleteTextView/i.test(n.cls)) {
          console.log(`  id="${n.id}" cls=${n.cls} password=${n.isPassword} text=${JSON.stringify(n.text)} bounds=${n.bounds}`);
        }
      }

      fs.mkdirSync(OUT_DIR, { recursive: true });
      const stamp = Date.now();
      fs.writeFileSync(path.join(OUT_DIR, `login-${PKG}-${stamp}.xml`), loginXml, 'utf8');
      console.log(`\nwrote login-${PKG}-${stamp}.xml`);
    }
  } finally {
    await driver.deleteSession();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
