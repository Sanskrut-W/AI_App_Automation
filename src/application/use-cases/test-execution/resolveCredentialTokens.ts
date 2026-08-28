import { TestStep } from '../../../core/value-objects/TestStep';
import { TestAccount } from '../../../core/value-objects/TestAccount';

/**
 * Placeholders a generated test case uses instead of literal credentials, resolved against the
 * test account assigned to the device the run is driving.
 *
 * Two reasons this is a placeholder rather than a value baked in at generation time:
 *   - One test case can then run on several devices at once, each signed in as a different
 *     account. Credentials written in at generation time bind a test case to one account, which
 *     makes parallel execution impossible without duplicating every test case per account.
 *   - Generated test cases stop containing a password in clear text, so they are safe to commit.
 */
export const CREDENTIAL_TOKENS = {
  mobileNumber: '{{account.mobileNumber}}',
  password: '{{account.password}}',
} as const;

const CREDENTIAL_TOKEN_PATTERN = /\{\{\s*account\.(mobileNumber|password)\s*\}\}/g;
/** Any remaining "{{…}}" after substitution, i.e. a placeholder nothing knows how to fill. */
const ANY_PLACEHOLDER_PATTERN = /\{\{[^}]*\}\}/;

/**
 * Substitutes credential placeholders in each step's `value`, returning new steps and leaving the
 * originals untouched.
 *
 * Throws rather than passing an unresolved placeholder through, because the alternative is typing
 * the literal text "{{account.password}}" into a real login form — repeated across runs that is
 * how a genuine account gets locked out. Callers should therefore run this before opening the
 * Appium session, so a misconfiguration fails the run before it touches the app at all.
 *
 * Never log or include a resolved value in an error: only the placeholder text, which is safe.
 */
export function resolveCredentialTokens(
  steps: TestStep[],
  account: TestAccount | null,
): TestStep[] {
  return steps.map((step) => {
    if (!step.value || !step.value.includes('{{')) {
      return step;
    }

    if (!account) {
      throw new Error(
        `Step ${step.stepNumber} needs test-account credentials (its value is "${step.value}") but ` +
          'no test account is configured for this package/device. Add one to ' +
          'config/test-accounts.json (see config/test-accounts.example.json).',
      );
    }

    const resolved = step.value.replace(
      CREDENTIAL_TOKEN_PATTERN,
      (_match, field: 'mobileNumber' | 'password') => account[field],
    );

    if (ANY_PLACEHOLDER_PATTERN.test(resolved)) {
      throw new Error(
        `Step ${step.stepNumber} has a placeholder this runner cannot resolve: "${step.value}". ` +
          `Supported placeholders are ${Object.values(CREDENTIAL_TOKENS).join(' and ')}.`,
      );
    }

    return { ...step, value: resolved };
  });
}
