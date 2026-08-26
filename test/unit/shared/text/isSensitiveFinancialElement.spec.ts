import { isSensitiveFinancialElement } from '../../../../src/shared/text/isSensitiveFinancialElement';

function element(overrides: Partial<Parameters<typeof isSensitiveFinancialElement>[0]> = {}) {
  return { text: '', contentDescription: '', resourceId: '', accessibilityId: '', ...overrides };
}

describe('isSensitiveFinancialElement', () => {
  it.each([
    ['Deposit Funds', 'text'],
    ['Withdraw', 'text'],
    ['Voucher Pin', 'text'],
    ['Redeem', 'text'],
    ['Top Up', 'text'],
    ['Top-up', 'text'],
    ['Card Number', 'text'],
    ['CVV', 'text'],
    ['Payment method', 'text'],
  ])('matches "%s" via %s', (value) => {
    expect(isSensitiveFinancialElement(element({ text: value }))).toBe(true);
  });

  it('matches via contentDescription', () => {
    expect(isSensitiveFinancialElement(element({ contentDescription: 'Make a deposit' }))).toBe(
      true,
    );
  });

  it('matches via resourceId', () => {
    expect(
      isSensitiveFinancialElement(element({ resourceId: 'com.example.app:id/voucherPinInput' })),
    ).toBe(true);
  });

  it('does not match unrelated elements', () => {
    expect(isSensitiveFinancialElement(element({ text: 'Promotions' }))).toBe(false);
  });

  it('does not match login/sign-up elements', () => {
    expect(isSensitiveFinancialElement(element({ text: 'Log In' }))).toBe(false);
    expect(isSensitiveFinancialElement(element({ text: 'Sign Up' }))).toBe(false);
  });

  it('does not match an empty element', () => {
    expect(isSensitiveFinancialElement(element())).toBe(false);
  });
});
