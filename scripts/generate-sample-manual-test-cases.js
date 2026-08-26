const { Workbook } = require('exceljs');
const path = require('path');

/** Builds a starter manual-test-cases.xlsx matching the exact column layout
 * ExcelManualTestCaseReader expects: Test Case Name, a status tag column (ignored), Objective, an
 * unused column, Step Number, Step Description, Expected Result. Test Case Name/Objective use
 * Excel's merged-cell convention: filled on the first row of a test case, blank on every row that
 * continues it. Seeded with the 3 login scenarios given for Betway ZA (app-appropriate: the
 * website's "Enter the URL..." step is dropped since it has no native-app equivalent and the
 * generator would skip it anyway).
 */
async function main() {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Manual Test Cases');
  sheet.columns = [
    { header: 'Test Case', key: 'testCase', width: 45 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Objective', key: 'objective', width: 40 },
    { header: 'Unused', key: 'unused', width: 10 },
    { header: 'Step', key: 'step', width: 6 },
    { header: 'Step Description', key: 'description', width: 55 },
    { header: 'Expected Result', key: 'expectedResult', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  const rows = [
    // TC1: direct login
    ['Verify that user is able to login', '', 'To check user is able to login', '', 1, 'Click login button', 'Login form opens'],
    ['', '', '', '', 2, 'Enter mobile number (on which account exists)', 'user must be able to enter mobile number'],
    ['', '', '', '', 3, 'Enter correct password', 'user must be able to enter password'],
    ['', '', '', '', 4, 'click login button', 'user should get logged in'],

    // TC2: login from hamburger menu
    ['Verify that user is able to login from hamburger menu', '', 'To check user is able to login from hamburger menu', '', 1, 'click menu (three horizontal line) button from the header', 'Menu should open'],
    ['', '', '', '', 2, 'click login button', 'login window should open'],
    ['', '', '', '', 3, 'Enter mobile number (on which account exists)', 'user must be able to enter mobile number'],
    ['', '', '', '', 4, 'Enter correct password', 'user must be able to enter password'],
    ['', '', '', '', 5, 'click login button', 'user should get logged in'],

    // TC3: login from the link inside the sign-up popup
    ['Verify that user is able to login from login button available on signup popup window', '', 'To check user is able to login from login button available on signup popup window', '', 1, 'click signup button', 'A signup popup window should open'],
    ['', '', '', '', 2, 'scroll to bottom and click login button', 'login window should open'],
    ['', '', '', '', 3, 'Enter mobile number (on which account exists)', 'user must be able to enter mobile number'],
    ['', '', '', '', 4, 'Enter correct password', 'user must be able to enter password'],
    ['', '', '', '', 5, 'click login button', 'user should get logged in'],
  ];

  for (const row of rows) {
    sheet.addRow(row);
  }

  const outPath = path.resolve(__dirname, '..', 'manual-test-cases', 'betway-za-login-tests.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('Wrote', outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
