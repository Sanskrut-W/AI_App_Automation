const fs = require('fs');

const P = 'c:\\Users\\SW115406\\Desktop\\AI_App_Automation\\artifacts\\apps\\com.betwayafrica.za\\test-cases\\manual\\105c7000-c5d5-41a9-a7ba-5c5d1dc08cf6.json';
const tc = JSON.parse(fs.readFileSync(P, 'utf8'));

// The drawer screen has three scrollable containers: the drawer's own ExpandableListView, the
// top-nav GridView, and a 2px-tall WebView strip. An unscoped `scrollable(true)` picks whichever
// UiAutomator matches first, which is not necessarily the drawer — so scope every drawer scroll to
// the drawer's list by resource-id (verified live on an S21 Ultra: scoped scrolled "Log Out" into
// view in 6.6s, while the unscoped form is a coin toss on which container it drives).
const SCOPED = 'new UiSelector().resourceId("com.betwayafrica.za:id/leftNavigationItems")';

let patched = 0;
for (const step of tc.steps) {
  const loc = step.targetLocator;
  if (!loc || loc.strategy !== 'android-uiautomator') continue;
  if (!loc.value.includes('new UiSelector().scrollable(true)')) continue;
  loc.value = loc.value.replace('new UiSelector().scrollable(true)', SCOPED);
  patched += 1;
}

fs.writeFileSync(P, JSON.stringify(tc, null, 2) + '\n');
console.log(`Scoped ${patched} drawer-scroll locators to leftNavigationItems.`);
