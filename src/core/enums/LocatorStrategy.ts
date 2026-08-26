export enum LocatorStrategy {
  RESOURCE_ID = 'resource-id',
  ACCESSIBILITY_ID = 'accessibility-id',
  XPATH_TEXT = 'xpath-text',
  XPATH_CLASS_INDEX = 'xpath-class-index',
  /** Raw UiAutomator UiSelector/UiScrollable expression, evaluated on-device. Its reason to exist
   * is scrolling: a `UiScrollable(...).scrollIntoView(...)` expression keeps swiping until the
   * target row actually materializes, which is the only reliable way to reach an item in a
   * virtualized list. Blind "swipe N times, then assert" recipes are inherently flaky on real
   * hardware, where fling momentum varies per gesture — proven live against Betway ZA's navigation
   * drawer, where a fixed swipe count calibrated on an emulator kept landing a row short or long
   * on a physical device. Value is the UiSelector expression itself, e.g.
   * `new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("X"))`. */
  ANDROID_UIAUTOMATOR = 'android-uiautomator',
  /** Last-resort fallback: taps the element's captured bounds center directly via a gesture,
   * bypassing accessibility-tree lookup entirely. Value is formatted as "x,y". */
  COORDINATES = 'coordinates',
}
