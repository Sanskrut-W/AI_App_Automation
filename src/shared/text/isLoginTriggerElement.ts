// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g. "btnLogin").
const LOGIN_TRIGGER_PATTERN = /log\s*in|sign\s*in/i;

export interface LoginTriggerCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/**
 * Matches a "Log In" / "Sign In" entry point specifically — distinct from isAuthElement, which
 * also matches "Sign Up"/"Register" (used to EXCLUDE all auth elements from crawling). This one
 * is used to deliberately find the login trigger, for the login test-case flow.
 */
export function isLoginTriggerElement(element: LoginTriggerCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return LOGIN_TRIGGER_PATTERN.test(haystack);
}
