import { ElementLocator } from '../../../core/value-objects/ElementLocator';
import { ScrollDirection } from '../../../core/enums/ScrollDirection';

/**
 * UI interaction commands needed by the crawler (tap, back) and the test execution engine
 * (sendKeys, scroll, getText, elementExists).
 */
export interface IInteractionDriver {
  tap(locator: ElementLocator): Promise<void>;
  back(): Promise<void>;
  sendKeys(locator: ElementLocator, value: string): Promise<void>;
  /** Empties a text field, e.g. to reset a search box between queries. */
  clearText(locator: ElementLocator): Promise<void>;
  /**
   * Fires the on-screen keyboard's action key ("search", "go", "done", "next", "send", "previous")
   * against whatever field currently has focus. Needed for inputs that only apply their value when
   * the IME action is used rather than on each keystroke — a WebView search box, typically.
   */
  pressImeAction(action: string): Promise<void>;
  scroll(direction: ScrollDirection): Promise<void>;
  /** Raw two-point drag gesture (no widget/locator involved) — for scrollable content the
   * generic scroll() can't reliably reach, e.g. a nested list inside a drawer/popup. */
  swipe(fromX: number, fromY: number, toX: number, toY: number): Promise<void>;
  getText(locator: ElementLocator): Promise<string>;
  /** Checks for element existence without throwing when the element is simply absent. */
  elementExists(locator: ElementLocator): Promise<boolean>;
}
