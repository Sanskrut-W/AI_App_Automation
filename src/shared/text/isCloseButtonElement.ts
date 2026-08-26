// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g.
// "btnSkip", "ic_close") where a real boundary never appears between adjacent words.
const CLOSE_BUTTON_PATTERN = /close|dismiss|skip|no\s*thanks|got\s*it/i;

export interface CloseCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/**
 * Matches elements that look like a dismiss/close control for an overlay (ad, promo, dialog), so a
 * stuck crawl can recognize and tap past it. Deliberately does NOT match "cancel" — during
 * autonomous crawling a "Cancel" button is frequently just a normal, legitimate element worth
 * exploring (see isCancelElement for the narrower, execution-recovery-only variant that does).
 */
export function isCloseButtonElement(element: CloseCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return CLOSE_BUTTON_PATTERN.test(haystack);
}
