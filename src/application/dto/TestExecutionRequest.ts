export interface TestExecutionRequest {
  deviceId: string;
  appPackage: string;
  appActivity?: string;
  /** Specific test case IDs to run; omit (or pass an empty array) to run every persisted test case. */
  testCaseIds?: string[];
}
