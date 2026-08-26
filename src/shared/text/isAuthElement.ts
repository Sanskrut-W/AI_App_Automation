// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g.
// "btnSignUp", "ic_login") where a real boundary never appears between adjacent words.
const AUTH_ELEMENT_PATTERN = /log\s*in|sign\s*in|sign\s*up|register|create\s*account/i;

export interface AuthCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/** Matches elements that look like a login/sign-up/register entry point, so callers can avoid tapping into an auth flow. */
export function isAuthElement(element: AuthCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return AUTH_ELEMENT_PATTERN.test(haystack);
}
