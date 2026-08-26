import { isAuthElement } from '../../../../src/shared/text/isAuthElement';

function element(overrides: Partial<Parameters<typeof isAuthElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isAuthElement', () => {
  it.each([
    ['Login', 'text'],
    ['Log In', 'text'],
    ['Sign Up', 'text'],
    ['Sign in', 'text'],
    ['Register', 'text'],
    ['Create Account', 'text'],
  ])('matches "%s" via %s', (value) => {
    expect(isAuthElement(element({ text: value }))).toBe(true);
  });

  it('matches via contentDescription', () => {
    expect(isAuthElement(element({ contentDescription: 'Log in to your account' }))).toBe(true);
  });

  it('matches via resourceId', () => {
    expect(isAuthElement(element({ resourceId: 'com.example.app:id/btnSignUp' }))).toBe(true);
  });

  it('matches via accessibilityId', () => {
    expect(isAuthElement(element({ accessibilityId: 'Sign up button' }))).toBe(true);
  });

  it('does not match unrelated elements', () => {
    expect(isAuthElement(element({ text: 'Promotions' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isAuthElement(element())).toBe(false);
  });
});
