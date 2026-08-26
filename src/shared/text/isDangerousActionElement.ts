// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g.
// "btnExitConfirm", "ic_logout") where a real boundary never appears between adjacent words.
const DANGEROUS_ACTION_PATTERN = /confirm\s*to\s*continue|exit|quit|log\s*out|sign\s*out/i;

export interface DangerousActionCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/**
 * Matches elements whose action would exit the app, end a session, or otherwise derail an
 * exploratory crawl — e.g. the "Confirm to continue" button on an Android "Exit app?"
 * confirmation dialog (shown when the crawler presses back on a screen with no back stack left).
 * Never tapped during crawling or turned into a generated menu-item test case.
 */
export function isDangerousActionElement(element: DangerousActionCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return DANGEROUS_ACTION_PATTERN.test(haystack);
}
