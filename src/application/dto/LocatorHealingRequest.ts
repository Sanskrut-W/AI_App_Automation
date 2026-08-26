export interface LocatorHealingRequest {
  /** Element repository id whose stored locators no longer resolve on the live screen. */
  elementId: string;
  /** Freshly captured XML hierarchy dump of the current screen. */
  currentXml: string;
}
