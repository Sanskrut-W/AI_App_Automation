export enum ActionType {
  CLICK = 'click',
  TYPE = 'type',
  SCROLL = 'scroll',
  /** Raw two-point drag gesture, bypassing scrollable-widget auto-detection entirely — proven
   * necessary live against a nested ExpandableListView (Betway ZA's navigation drawer) where the
   * generic SCROLL action's "mobile: scrollGesture" silently no-ops because it can't resolve the
   * right scrollable widget from a large bounding box. Step.value carries "x1,y1,x2,y2". */
  SWIPE = 'swipe',
  BACK = 'back',
  WAIT = 'wait',
  VERIFY_TEXT = 'verify_text',
  VERIFY_ELEMENT_EXISTS = 'verify_element_exists',
}
