import { TestStep } from './TestStep';

/** A real, already-registered account's credentials for a target app — used wherever a test case
 * needs to log in as a genuine user rather than freshly invented random data (see
 * generateRandomSignUpDetails for the "any random data is fine" counterpart, used by sign-up). */
export interface TestAccount {
  mobileNumber: string;
  password: string;
  /** Which named account this came from, for logging. Absent for the single default account.
   *  Never log the credentials themselves — this id is the safe thing to record. */
  accountId?: string;
  /** Optional teardown recipe: run once after every executed test case (see
   * TestExecutionEngine), so no test case ever inherits a leftover logged-in session from
   * whichever one ran before it. Its own first step must be a "logged in?" gate check — the
   * teardown stops there (a no-op) when it fails, which is what makes it safe to run
   * unconditionally after every test case rather than only ones known to log in. Omit for apps
   * with no login/logout concept, or where per-test-case session leakage isn't a concern. */
  logoutSteps?: TestStep[];
}
