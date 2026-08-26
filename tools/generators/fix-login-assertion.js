const fs = require('fs');

const P = 'c:\\Users\\SW115406\\Desktop\\AI_App_Automation\\artifacts\\apps\\com.betwayafrica.za\\test-cases\\login\\4b780231-1dab-4eb7-b307-f59176c8193e.json';
const tc = JSON.parse(fs.readFileSync(P, 'utf8'));

// Idempotent: rebuild everything after the submit tap.
const submitIdx = tc.steps.findIndex(
  (s) => s.action === 'click' && s.targetLocator && s.targetLocator.value.endsWith(':id/loginSignIn'),
);
if (submitIdx === -1) throw new Error('could not find the loginSignIn submit step');
tc.steps = tc.steps.slice(0, submitIdx + 1);

let n = tc.steps.length;
const push = (step) => tc.steps.push({ stepNumber: ++n, ...step });
const base = { targetLocator: null, elementId: null, value: null, direction: null, durationMs: null };

const optionalTap = (value, expectedResult) =>
  push({ ...base, action: 'click', targetLocator: { strategy: 'resource-id', value }, optional: true, expectedResult });

push({
  ...base,
  action: 'wait',
  durationMs: 3000,
  expectedResult:
    'The login request finishes. Login is asynchronous and slower on real hardware than on the emulator — the original 800ms ended the run while the spinner was still turning.',
});

// Post-login, Betway ZA can stack up to two popups over the native toolbar:
//   - "Biometric Setup" (physical devices only; never seen on the emulator) — a real Dialog window.
//     Android's accessibility tree only exposes the topmost window, so while it is up the toolbar's
//     ids are absent from the hierarchy and the assertion at the end cannot see them.
//   - a "New Casino Experience" promo interstitial (fresh installs) / "Withdrawal Alert" freebet
//     warning, both under resource-id "modal-close-btn". These render in the same window as the
//     toolbar, so they do NOT hide it — they are dismissed only to leave a clean state.
//
// Crucially these appear on their own schedule: proven live on an S21 Ultra where the biometric
// prompt had still not appeared 3.5s after login, so a single dismissal attempt no-opped and the
// prompt then surfaced in time to break the assertion. Retry the Skip a few times, spaced out, so
// it is caught whenever it lands. Always Skip, never Allow — this is a real account and we do not
// enrol biometrics on it.
for (let attempt = 0; attempt < 3; attempt += 1) {
  optionalTap(
    'com.betwayafrica.za:id/biometricSkip',
    `Attempt ${attempt + 1} of 3 to dismiss the post-login Biometric Setup prompt via Skip, if it has appeared by now; otherwise a no-op.`,
  );
  push({
    ...base,
    action: 'wait',
    durationMs: 2500,
    expectedResult: 'Gives the prompt time to appear (or to finish dismissing) before the next attempt.',
  });
}

for (let i = 0; i < 2; i += 1) {
  optionalTap(
    'modal-close-btn',
    'If a promo interstitial or Withdrawal Alert layer is present, it is closed; otherwise this step is a no-op.',
  );
}

push({
  ...base,
  action: 'wait',
  durationMs: 1200,
  expectedResult: 'Any popup dismissal settles and the toolbar renders before the login state is asserted.',
});

// The actual point of this test case. Without it the test passes whenever the taps land, even if
// login silently failed — proven live twice: once when corporate DNS blocked betway.co.za, and
// again on the S21 Ultra, where the final screenshot showed the spinner still turning.
push({
  ...base,
  action: 'verify_element_exists',
  targetLocator: { strategy: 'resource-id', value: 'com.betwayafrica.za:id/toolbarDeposit' },
  expectedResult:
    'The toolbar shows the logged-in Deposit control, proving the account is actually signed in — not merely that every tap registered.',
  screenshotLabel: 'After login',
});

// Screenshots are captured only for labelled steps (plus failures), so this test case yields two
// images — the logged-out start and the signed-in result — instead of one per step.
tc.steps[0].screenshotLabel = 'Before login';

fs.writeFileSync(P, JSON.stringify(tc, null, 2) + '\n');
console.log(`Wrote ${tc.steps.length} steps.`);
