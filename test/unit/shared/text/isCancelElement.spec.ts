import { isCancelElement } from '../../../../src/shared/text/isCancelElement';

function element(overrides: Partial<Parameters<typeof isCancelElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isCancelElement', () => {
  it('matches "Cancel" via text', () => {
    expect(isCancelElement(element({ text: 'Cancel' }))).toBe(true);
  });

  it('matches via contentDescription', () => {
    expect(isCancelElement(element({ contentDescription: 'Cancel exit' }))).toBe(true);
  });

  it('matches via resourceId', () => {
    expect(isCancelElement(element({ resourceId: 'com.example.app:id/exitCancel' }))).toBe(true);
  });

  it('does not match unrelated elements', () => {
    expect(isCancelElement(element({ text: 'Confirm to continue' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isCancelElement(element())).toBe(false);
  });
});
