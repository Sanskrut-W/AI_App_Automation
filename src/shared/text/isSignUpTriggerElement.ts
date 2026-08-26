// No \b word-boundary anchors: resourceIds are frequently camelCase/snake_case (e.g. "btnSignUp").
const SIGN_UP_TRIGGER_PATTERN = /sign\s*up|register|create\s*account/i;

export interface SignUpTriggerCheckableElement {
  text: string;
  contentDescription: string;
  resourceId: string;
  accessibilityId: string;
}

/**
 * Matches a "Sign Up" / "Register" / "Create Account" entry point specifically — distinct from
 * isLoginTriggerElement (Log In / Sign In). Used to deliberately find the sign-up trigger, for the
 * sign-up test-case flow.
 */
export function isSignUpTriggerElement(element: SignUpTriggerCheckableElement): boolean {
  const haystack = [
    element.text,
    element.contentDescription,
    element.resourceId,
    element.accessibilityId,
  ].join(' ');
  return SIGN_UP_TRIGGER_PATTERN.test(haystack);
}
