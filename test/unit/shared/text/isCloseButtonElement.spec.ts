import { isCloseButtonElement } from '../../../../src/shared/text/isCloseButtonElement';

function element(overrides: Partial<Parameters<typeof isCloseButtonElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isCloseButtonElement', () => {
  it.each([
    ['Close', 'text'],
    ['Dismiss', 'text'],
    ['Skip', 'text'],
    ['No thanks', 'text'],
    ['Got it', 'text'],
  ])('matches "%s" via %s', (value) => {
    expect(isCloseButtonElement(element({ text: value }))).toBe(true);
  });

  it('does not match "Cancel" — during crawling it is frequently a normal, legitimate element', () => {
    expect(isCloseButtonElement(element({ text: 'Cancel' }))).toBe(false);
  });

  it('matches via contentDescription', () => {
    expect(isCloseButtonElement(element({ contentDescription: 'Close ad' }))).toBe(true);
  });

  it('matches via resourceId', () => {
    expect(isCloseButtonElement(element({ resourceId: 'com.example.app:id/btn_close' }))).toBe(
      true,
    );
  });

  it('does not match unrelated elements', () => {
    expect(isCloseButtonElement(element({ text: 'Promotions' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isCloseButtonElement(element())).toBe(false);
  });
});
