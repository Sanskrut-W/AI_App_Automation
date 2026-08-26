import { createHash } from 'crypto';
import { Element } from '../../../core/entities/Element';
import { Screen } from '../../../core/entities/Screen';
import { ElementBounds } from '../../../core/value-objects/ElementBounds';
import {
  ElementFingerprint,
  ElementFingerprintComponents,
} from '../../../core/value-objects/ElementFingerprint';
import { ScreenFingerprint } from '../../../core/value-objects/ScreenFingerprint';
import { textSimilarity } from '../../../shared/text/textSimilarity';
import { IFingerprintEngine } from './IFingerprintEngine';

const DEFAULT_ELEMENT_DUPLICATE_THRESHOLD = 0.95;
const DEFAULT_SCREEN_DUPLICATE_THRESHOLD = 0.9;

// Element similarity weights — must sum to 1. className/resourceId dominate since they're the
// most stable identifiers; bounds/position contribute less since they shift across screen sizes.
const WEIGHTS = {
  className: 0.25,
  resourceId: 0.2,
  accessibilityId: 0.15,
  text: 0.15,
  bounds: 0.1,
  parentClassName: 0.05,
  childClassNames: 0.05,
  clickable: 0.05,
};

/**
 * Deterministic, non-AI fingerprinting for screens and elements: stable structural signatures
 * for exact duplicate detection (via hash) and graded similarity (for Module 14's future
 * self-healing, which will compare a stale fingerprint against freshly-parsed elements to find
 * the best match after a locator breaks).
 */
export class FingerprintEngine implements IFingerprintEngine {
  fingerprintElement(element: Element, allElementsOnScreen: Element[]): ElementFingerprint {
    const parent =
      allElementsOnScreen.find((candidate) => candidate.elementId === element.parentElementId) ??
      null;
    const children = allElementsOnScreen.filter((candidate) =>
      element.childElementIds.includes(candidate.elementId),
    );
    const position = parent ? parent.childElementIds.indexOf(element.elementId) : 0;

    const components: ElementFingerprintComponents = {
      className: element.className,
      text: element.text,
      resourceId: element.resourceId,
      accessibilityId: element.accessibilityId,
      bounds: element.bounds,
      parentClassName: parent?.className ?? '',
      childClassNames: children.map((child) => child.className).sort(),
      position,
      clickable: element.clickable,
    };

    return {
      elementId: element.elementId,
      hash: this.hash(components),
      components,
    };
  }

  fingerprintScreen(screen: Screen, elementFingerprints: ElementFingerprint[]): ScreenFingerprint {
    const elementHashes = elementFingerprints.map((fingerprint) => fingerprint.hash).sort();

    return {
      screenId: screen.screenId,
      hash: this.hash({
        packageName: screen.packageName,
        activityName: screen.activityName,
        elementHashes,
      }),
      components: {
        packageName: screen.packageName,
        activityName: screen.activityName,
        elementHashes,
        elementCount: elementFingerprints.length,
      },
    };
  }

  elementSimilarity(a: ElementFingerprint, b: ElementFingerprint): number {
    const ca = a.components;
    const cb = b.components;

    const classNameScore = ca.className === cb.className ? 1 : 0;
    const resourceIdScore = this.exactOrBothEmptyScore(ca.resourceId, cb.resourceId);
    const accessibilityIdScore = this.exactOrBothEmptyScore(ca.accessibilityId, cb.accessibilityId);
    const textScore = textSimilarity(ca.text, cb.text);
    const boundsScore = this.boundsIoU(ca.bounds, cb.bounds);
    const parentClassNameScore = ca.parentClassName === cb.parentClassName ? 1 : 0;
    const childClassNamesScore = this.jaccard(ca.childClassNames, cb.childClassNames);
    const clickableScore = ca.clickable === cb.clickable ? 1 : 0;

    return (
      classNameScore * WEIGHTS.className +
      resourceIdScore * WEIGHTS.resourceId +
      accessibilityIdScore * WEIGHTS.accessibilityId +
      textScore * WEIGHTS.text +
      boundsScore * WEIGHTS.bounds +
      parentClassNameScore * WEIGHTS.parentClassName +
      childClassNamesScore * WEIGHTS.childClassNames +
      clickableScore * WEIGHTS.clickable
    );
  }

  screenSimilarity(a: ScreenFingerprint, b: ScreenFingerprint): number {
    if (a.components.packageName !== b.components.packageName) {
      return 0;
    }
    const activityScore = a.components.activityName === b.components.activityName ? 1 : 0;
    const elementsScore = this.jaccard(a.components.elementHashes, b.components.elementHashes);
    return activityScore * 0.3 + elementsScore * 0.7;
  }

  isDuplicateElement(
    a: ElementFingerprint,
    b: ElementFingerprint,
    threshold: number = DEFAULT_ELEMENT_DUPLICATE_THRESHOLD,
  ): boolean {
    return this.elementSimilarity(a, b) >= threshold;
  }

  isDuplicateScreen(
    a: ScreenFingerprint,
    b: ScreenFingerprint,
    threshold: number = DEFAULT_SCREEN_DUPLICATE_THRESHOLD,
  ): boolean {
    return this.screenSimilarity(a, b) >= threshold;
  }

  private exactOrBothEmptyScore(a: string, b: string): number {
    if (!a && !b) {
      return 1;
    }
    if (!a || !b) {
      return 0;
    }
    return a === b ? 1 : 0;
  }

  /** Intersection-over-Union of two bounding boxes — a standard, deterministic overlap measure. */
  private boundsIoU(a: ElementBounds, b: ElementBounds): number {
    const interLeft = Math.max(a.left, b.left);
    const interTop = Math.max(a.top, b.top);
    const interRight = Math.min(a.right, b.right);
    const interBottom = Math.min(a.bottom, b.bottom);
    const interArea = Math.max(0, interRight - interLeft) * Math.max(0, interBottom - interTop);

    const areaA = Math.max(0, a.right - a.left) * Math.max(0, a.bottom - a.top);
    const areaB = Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
    const unionArea = areaA + areaB - interArea;

    if (unionArea === 0) {
      return areaA === 0 && areaB === 0 ? 1 : 0;
    }
    return interArea / unionArea;
  }

  private jaccard(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size === 0 && setB.size === 0) {
      return 1;
    }
    const intersectionSize = [...setA].filter((value) => setB.has(value)).length;
    const unionSize = new Set([...setA, ...setB]).size;
    return unionSize === 0 ? 1 : intersectionSize / unionSize;
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
