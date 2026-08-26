import { isDangerousActionElement } from '../../../../src/shared/text/isDangerousActionElement';

function element(overrides: Partial<Parameters<typeof isDangerousActionElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isDangerousActionElement', () => {
  it.each([
    ['Confirm to continue', 'text'],
    ['Exit', 'text'],
    ['Quit', 'text'],
    ['Log Out', 'text'],
    ['Sign out', 'text'],
  ])('matches "%s" via %s', (value) => {
    expect(isDangerousActionElement(element({ text: value }))).toBe(true);
  });

  it('matches via contentDescription', () => {
    expect(isDangerousActionElement(element({ contentDescription: 'Exit the app' }))).toBe(true);
  });

  it('matches via resourceId', () => {
    expect(
      isDangerousActionElement(element({ resourceId: 'com.example.app:id/exitConfirm' })),
    ).toBe(true);
  });

  it('does not match unrelated elements', () => {
    expect(isDangerousActionElement(element({ text: 'Cancel' }))).toBe(false);
    expect(isDangerousActionElement(element({ text: 'Promotions' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isDangerousActionElement(element())).toBe(false);
  });
});
