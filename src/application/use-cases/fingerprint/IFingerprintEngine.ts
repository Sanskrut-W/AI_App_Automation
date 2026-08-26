import { Element } from '../../../core/entities/Element';
import { Screen } from '../../../core/entities/Screen';
import { ElementFingerprint } from '../../../core/value-objects/ElementFingerprint';
import { ScreenFingerprint } from '../../../core/value-objects/ScreenFingerprint';

export interface IFingerprintEngine {
  fingerprintElement(element: Element, allElementsOnScreen: Element[]): ElementFingerprint;
  fingerprintScreen(screen: Screen, elementFingerprints: ElementFingerprint[]): ScreenFingerprint;
  elementSimilarity(a: ElementFingerprint, b: ElementFingerprint): number;
  screenSimilarity(a: ScreenFingerprint, b: ScreenFingerprint): number;
  isDuplicateElement(a: ElementFingerprint, b: ElementFingerprint, threshold?: number): boolean;
  isDuplicateScreen(a: ScreenFingerprint, b: ScreenFingerprint, threshold?: number): boolean;
}
