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
  WAIT = 'wait',
  VERIFY_TEXT = 'verify_text',
  VERIFY_ELEMENT_EXISTS = 'verify_element_exists',
}
