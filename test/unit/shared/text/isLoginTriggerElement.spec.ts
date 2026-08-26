import { isLoginTriggerElement } from '../../../../src/shared/text/isLoginTriggerElement';

function element(overrides: Partial<Parameters<typeof isLoginTriggerElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isLoginTriggerElement', () => {
  it.each([
    ['Login', 'text'],
    ['Log In', 'text'],
    ['Sign in', 'text'],
  ])('matches "%s" via %s', (value) => {
    expect(isLoginTriggerElement(element({ text: value }))).toBe(true);
  });

  it('matches via resourceId (camelCase)', () => {
    expect(isLoginTriggerElement(element({ resourceId: 'com.example.app:id/btnLogin' }))).toBe(
      true,
    );
  });

  it('does not match Sign Up (a different auth entry point)', () => {
    expect(isLoginTriggerElement(element({ text: 'Sign Up' }))).toBe(false);
  });

  it('does not match unrelated elements', () => {
    expect(isLoginTriggerElement(element({ text: 'Promotions' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isLoginTriggerElement(element())).toBe(false);
  });
});
