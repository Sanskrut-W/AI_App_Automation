// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g.
// "voucherPinInput", "btn_redeem") where a real boundary never appears between adjacent words.
const SENSITIVE_FINANCIAL_PATTERN =
  /deposit|withdraw|voucher|redeem|top[\s-]?up|card\s*number|cvv|payment/i;

export interface SensitiveFinancialCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/**
 * Matches elements that indicate the current screen is a real-money flow (deposit, withdrawal,
 * voucher redemption, card/payment entry) — proven live against Betway ZA, where an unrelated tap
 * silently navigated off the intended screen and a later coordinate-healing fallback (meant to
 * type a cached login password) instead typed it into a "Voucher Pin" field on a Deposit Funds
 * screen. Nothing in this codebase should tap, type into, or otherwise heal a step while any
 * element on the current screen matches this — the safe response is always to refuse and fail
 * the step, never to guess.
 */
export function isSensitiveFinancialElement(element: SensitiveFinancialCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return SENSITIVE_FINANCIAL_PATTERN.test(haystack);
}
