// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g.
// "exitCancel", "btn_cancel") where a real boundary never appears between adjacent words.
const CANCEL_PATTERN = /cancel/i;

export interface CancelCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/**
 * Matches a "Cancel"-style decline control — narrower than isCloseButtonElement and deliberately
 * NOT folded into it: during autonomous crawling, a "Cancel" button is frequently just a normal,
 * legitimate element worth exploring (proven live: including "cancel" there made the crawler skip
 * past ordinary screens, losing coverage). During test-execution recovery, though, declining a
 * confirmation dialog is always the safe choice — the alternative is committing to whatever it's
 * confirming — which is why TestStepExecutor's failure-recovery paths check this in addition to
 * isCloseButtonElement, while ScreenCrawler checks only the latter.
 */
export function isCancelElement(element: CancelCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return CANCEL_PATTERN.test(haystack);
}
