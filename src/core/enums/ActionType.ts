export enum ActionType {
  CLICK = 'click',
  TYPE = 'type',
  SCROLL = 'scroll',
  /** Raw two-point drag gesture, bypassing scrollable-widget auto-detection entirely — proven
   * necessary live against a nested ExpandableListView (Betway ZA's navigation drawer) where the
   * generic SCROLL action's "mobile: scrollGesture" silently no-ops because it can't resolve the
   * right scrollable widget from a large bounding box. Step.value carries "x1,y1,x2,y2". */
  SWIPE = 'swipe',
  /** Empties a text field. Typing an empty string is a no-op, so clearing needs its own action. */
  CLEAR = 'clear',
  /** Presses the on-screen keyboard's action key against the focused field. Step.value carries the
   * action name ("search", "go", "done", "next", "send", "previous"), defaulting to "search".
   * Proven necessary live: Betway ZA's transaction-history search box filters nothing on keystrokes
   * and only runs the query when the IME's Go/Search key is pressed. */
  PRESS_IME_ACTION = 'press_ime_action',
  BACK = 'back',
  /**
   * Brings an app to the foreground, resuming it rather than restarting it. Step.value carries the
   * package name.
   *
   * Exists for the case where a tap leaves the app under test entirely — an app-store link, a
   * browser hand-off. Once that happens the app's own close control is off screen, so the usual
   * "tap the screen's X" recovery cannot work and every later step would run against the wrong app.
   * This is the way back, and deliberately not BACK, whose behaviour from a foreign app's own back
   * stack is not ours to predict; activateApp also resumes rather than restarts, so a signed-in
   * session survives the round trip.
   *
   * Added for Betway ZA's "Betway Scores App" drawer row on the assumption it opened the Play Store.
   * It does not — that row turns out to open an ordinary in-app page carrying store BUTTONS — so no
   * test case currently uses this action. Kept because the capability is real and tested, and
   * nothing else in the framework can recover from a genuine deep-link out.
   */
  ACTIVATE_APP = 'activate_app',
  WAIT = 'wait',
  VERIFY_TEXT = 'verify_text',
  VERIFY_ELEMENT_EXISTS = 'verify_element_exists',
}
