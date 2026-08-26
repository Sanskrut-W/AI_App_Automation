const { Workbook } = require('exceljs');
const path = require('path');

/** Builds a manual-test-cases.xlsx for the 3 header-area test cases (Betway logo visibility,
 * hamburger menu visibility/click, Login/Sign-Up buttons in the hamburger menu), matching the
 * exact column layout ExcelManualTestCaseReader expects. The website's "Enter the URL..." step
 * is kept as-is (the step interpreter auto-detects and skips web-only steps that have no native
 * app equivalent, same as the login test cases).
 */
async function main() {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Manual Test Cases');
  sheet.columns = [
    { header: 'Test Case', key: 'testCase', width: 55 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Objective', key: 'objective', width: 50 },
    { header: 'Unused', key: 'unused', width: 10 },
    { header: 'Step', key: 'step', width: 6 },
    { header: 'Step Description', key: 'description', width: 60 },
    { header: 'Expected Result', key: 'expectedResult', width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };

  const rows = [
    // TC1: Betway Logo visible on homepage
    [
      'Verify Betway Logo is visible on Homepage.',
      '',
      'Check that Betway Logo is visible on the homepage.',
      '',
      1,
      'Enter the URL of Betway - https://synapse-uat.Betway.com.gh/',
      'Betway Application should be accessible',
    ],
    [
      '',
      '',
      '',
      '',
      2,
      'Verify the Betway Logo is visible on home page of Betway application.',
      'The Betway Logo should be visible on the homepage.',
    ],

    // TC2: Hamburger menu visible and clickable on homepage
    [
      'Verify Hamburger menu is visible and clickable on Homepage.',
      '',
      'Check that Hamburger menu is visible and clickable on the homepage.',
      '',
      1,
      'Enter the URL of Betway - https://synapse-uat.Betway.com.gh/',
      'Betway Application should be accessible',
    ],
    [
      '',
      '',
      '',
      '',
      2,
      'Verify Hamburger menu is visible on the homepage of Betway application.',
      'The Hamburger menu should be visible on the homepage of Betway application.',
    ],
    ['', '', '', '', 3, 'Click on Hamburger Menu.', 'The Hamburger menu should be open.'],

    // TC3: Login and Sign-Up buttons visible and clickable in Hamburger Menu
    [
      'Verify Login and Sign-Up button are visible and clickable in Hamburger Menu.',
      '',
      'Check that Login and Sign-Up button are visible and clickable in Hamburger Menu.',
      '',
      1,
      'Enter the URL of Betway - https://synapse-uat.Betway.com.gh/',
      'Betway Application should be accessible.',
    ],
    ['', '', '', '', 2, 'Click on Hamburger Menu.', 'The Hamburger menu should be open.'],
    [
      '',
      '',
      '',
      '',
      3,
      'Verify Login and Sign-Up button are displayed in Hamburger Menu.',
      'The Login and Sign-Up button should be visible.',
    ],
    [
      '',
      '',
      '',
      '',
      4,
      'Click on Login and Sign-Up button of the Hamburger Menu.',
      'The Login and Sign-Up window should be open after clicking on Login and Sign-Up button.',
    ],
  ];

  for (const row of rows) {
    sheet.addRow(row);
  }

  const outPath = path.resolve(__dirname, '..', 'manual-test-cases', 'betway-za-header-tests.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('Wrote', outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
