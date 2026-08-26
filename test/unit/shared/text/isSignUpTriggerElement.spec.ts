import { isSignUpTriggerElement } from '../../../../src/shared/text/isSignUpTriggerElement';

function element(overrides: Partial<Parameters<typeof isSignUpTriggerElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isSignUpTriggerElement', () => {
  it.each([
    ['Sign Up', 'text'],
    ['Register', 'text'],
    ['Create Account', 'text'],
  ])('matches "%s" via %s', (value) => {
    expect(isSignUpTriggerElement(element({ text: value }))).toBe(true);
  });

  it('matches via resourceId (camelCase)', () => {
    expect(isSignUpTriggerElement(element({ resourceId: 'com.example.app:id/btnSignUp' }))).toBe(
      true,
    );
  });

  it('does not match Log In / Sign In (a different auth entry point)', () => {
    expect(isSignUpTriggerElement(element({ text: 'Log In' }))).toBe(false);
    expect(isSignUpTriggerElement(element({ text: 'Sign In' }))).toBe(false);
  });

  it('does not match unrelated elements', () => {
    expect(isSignUpTriggerElement(element({ text: 'Promotions' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isSignUpTriggerElement(element())).toBe(false);
  });
});
