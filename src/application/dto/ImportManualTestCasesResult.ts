export interface ImportManualTestCasesResult {
  packageName: string;
  excelFilePath: string;
  testCasesFound: number;
  testCasesGenerated: number;
  appDataRoot: string;
}
