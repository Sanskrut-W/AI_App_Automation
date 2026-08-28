import { resolveCredentialTokens } from '../../../../../src/application/use-cases/test-execution/resolveCredentialTokens';
import { TestStep } from '../../../../../src/core/value-objects/TestStep';
import { TestAccount } from '../../../../../src/core/value-objects/TestAccount';
import { ActionType } from '../../../../../src/core/enums/ActionType';

const ACCOUNT: TestAccount = { mobileNumber: '123456789', password: 'sekrit', accountId: 'a' };

function step(overrides: Partial<TestStep> = {}): TestStep {
  return {
    stepNumber: 1,
    action: ActionType.TYPE,
    targetLocator: null,
    elementId: null,
    value: null,
    direction: null,
    durationMs: null,
    expectedResult: 'ok',
    ...overrides,
  };
}

describe('resolveCredentialTokens', () => {
  it('substitutes the mobile number and password placeholders', () => {
    const steps = [
      step({ stepNumber: 1, value: '{{account.mobileNumber}}' }),
      step({ stepNumber: 2, value: '{{account.password}}' }),
    ];

    const resolved = resolveCredentialTokens(steps, ACCOUNT);

    expect(resolved[0].value).toBe('123456789');
    expect(resolved[1].value).toBe('sekrit');
  });

  it('tolerates surrounding whitespace inside the placeholder', () => {
    const resolved = resolveCredentialTokens([step({ value: '{{ account.password }}' })], ACCOUNT);

    expect(resolved[0].value).toBe('sekrit');
  });

  it('leaves steps without a placeholder untouched, including non-credential values', () => {
    const steps = [
      step({ stepNumber: 1, value: '992381343' }),
      step({ stepNumber: 2, value: null }),
      step({ stepNumber: 3, action: ActionType.WAIT, durationMs: 500 }),
    ];

    const resolved = resolveCredentialTokens(steps, ACCOUNT);

    expect(resolved[0]).toBe(steps[0]);
    expect(resolved[1]).toBe(steps[1]);
    expect(resolved[2]).toBe(steps[2]);
  });

  it('does not mutate the steps it is given', () => {
    const original = step({ value: '{{account.password}}' });

    resolveCredentialTokens([original], ACCOUNT);

    expect(original.value).toBe('{{account.password}}');
  });

  it('throws when a step needs credentials but no account is configured', () => {
    expect(() => resolveCredentialTokens([step({ value: '{{account.password}}' })], null)).toThrow(
      /no test account is configured/i,
    );
  });

  it('throws rather than typing an unresolvable placeholder into a real login form', () => {
    expect(() => resolveCredentialTokens([step({ value: '{{account.pin}}' })], ACCOUNT)).toThrow(
      /placeholder this runner cannot resolve/i,
    );
  });

  it('never puts a resolved credential in the error message', () => {
    try {
      resolveCredentialTokens(
        [step({ value: '{{account.mobileNumber}} {{account.pin}}' })],
        ACCOUNT,
      );
      throw new Error('expected it to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(ACCOUNT.mobileNumber);
      expect(message).not.toContain(ACCOUNT.password);
    }
  });
});
