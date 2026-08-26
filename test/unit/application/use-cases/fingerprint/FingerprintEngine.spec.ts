import { FingerprintEngine } from '../../../../../src/application/use-cases/fingerprint/FingerprintEngine';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { Screen, ScreenProps } from '../../../../../src/core/entities/Screen';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Calculate',
    resourceId: 'com.example.app:id/btnCalculate',
    accessibilityId: '',
    contentDescription: '',
    bounds: { left: 100, top: 200, right: 300, bottom: 260 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: 'parent-1',
    childElementIds: [],
    locators: [
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/btnCalculate',
        priority: 1,
      },
    ],
    ...overrides,
  });
}

function createScreen(overrides: Partial<ScreenProps> = {}): Screen {
  return new Screen({
    screenId: 'screen-1',
    screenName: 'Home',
    screenshotPath: '/artifacts/screenshots/screen-1.png',
    xmlPath: '/artifacts/xml-dumps/screen-1.xml',
    packageName: 'com.example.app',
    activityName: '.MainActivity',
    parentScreenId: null,
    navigationPath: ['screen-1'],
    discoveredAt: '2026-07-20T00:00:00.000Z',
    structuralHash: 'hash-1',
    ...overrides,
  });
}

describe('FingerprintEngine', () => {
  describe('fingerprintElement', () => {
    it('resolves parentClassName, childClassNames, and position from the full element list', () => {
      const engine = new FingerprintEngine();
      const parent = createElement({
        elementId: 'parent-1',
        className: 'android.widget.LinearLayout',
        parentElementId: null,
        childElementIds: ['element-1', 'element-2'],
      });
      const target = createElement({ elementId: 'element-1', parentElementId: 'parent-1' });
      const sibling = createElement({
        elementId: 'element-2',
        className: 'android.widget.EditText',
        parentElementId: 'parent-1',
      });

      const fingerprint = engine.fingerprintElement(target, [parent, target, sibling]);

      expect(fingerprint.elementId).toBe('element-1');
      expect(fingerprint.components.parentClassName).toBe('android.widget.LinearLayout');
      expect(fingerprint.components.position).toBe(0);
    });

    it('defaults to an empty parentClassName and position 0 for a root element', () => {
      const engine = new FingerprintEngine();
      const root = createElement({
        elementId: 'root-1',
        parentElementId: null,
        childElementIds: [],
      });

      const fingerprint = engine.fingerprintElement(root, [root]);

      expect(fingerprint.components.parentClassName).toBe('');
      expect(fingerprint.components.position).toBe(0);
    });

    it('produces the same hash for two structurally identical elements with different elementIds', () => {
      const engine = new FingerprintEngine();
      const a = createElement({ elementId: 'element-a' });
      const b = createElement({ elementId: 'element-b' });

      const fingerprintA = engine.fingerprintElement(a, [a]);
      const fingerprintB = engine.fingerprintElement(b, [b]);

      expect(fingerprintA.hash).toBe(fingerprintB.hash);
    });

    it('produces a different hash when a meaningful attribute differs', () => {
      const engine = new FingerprintEngine();
      const a = createElement({ elementId: 'element-a', text: 'Calculate' });
      const b = createElement({ elementId: 'element-b', text: 'Clear' });

      const fingerprintA = engine.fingerprintElement(a, [a]);
      const fingerprintB = engine.fingerprintElement(b, [b]);

      expect(fingerprintA.hash).not.toBe(fingerprintB.hash);
    });
  });

  describe('elementSimilarity', () => {
    it('scores identical elements (aside from elementId) as a perfect match', () => {
      const engine = new FingerprintEngine();
      const a = createElement({ elementId: 'element-a' });
      const b = createElement({ elementId: 'element-b' });

      const score = engine.elementSimilarity(
        engine.fingerprintElement(a, [a]),
        engine.fingerprintElement(b, [b]),
      );

      expect(score).toBeCloseTo(1, 5);
    });

    it('scores a slightly shifted element (same identity, moved bounds) highly but not perfectly', () => {
      const engine = new FingerprintEngine();
      const a = createElement({
        elementId: 'element-a',
        bounds: { left: 100, top: 200, right: 300, bottom: 260 },
      });
      const b = createElement({
        elementId: 'element-b',
        bounds: { left: 110, top: 200, right: 310, bottom: 260 },
      });

      const score = engine.elementSimilarity(
        engine.fingerprintElement(a, [a]),
        engine.fingerprintElement(b, [b]),
      );

      expect(score).toBeGreaterThan(0.9);
      expect(score).toBeLessThan(1);
    });

    it('scores a completely different element very low', () => {
      const engine = new FingerprintEngine();
      const button = createElement({
        elementId: 'element-a',
        className: 'android.widget.Button',
        text: 'Calculate',
        resourceId: 'com.example.app:id/btnCalculate',
        bounds: { left: 100, top: 200, right: 300, bottom: 260 },
        clickable: true,
      });
      const label = createElement({
        elementId: 'element-b',
        className: 'android.widget.TextView',
        text: 'Version 2.1',
        resourceId: '',
        bounds: { left: 900, top: 1800, right: 1000, bottom: 1850 },
        clickable: false,
      });

      const score = engine.elementSimilarity(
        engine.fingerprintElement(button, [button]),
        engine.fingerprintElement(label, [label]),
      );

      expect(score).toBeLessThan(0.3);
    });

    it('treats two elements with no resourceId/accessibilityId as matching on those fields (both empty)', () => {
      const engine = new FingerprintEngine();
      const a = createElement({ elementId: 'element-a', resourceId: '', accessibilityId: '' });
      const b = createElement({ elementId: 'element-b', resourceId: '', accessibilityId: '' });

      const score = engine.elementSimilarity(
        engine.fingerprintElement(a, [a]),
        engine.fingerprintElement(b, [b]),
      );

      expect(score).toBeCloseTo(1, 5);
    });
  });

  describe('isDuplicateElement', () => {
    it('treats a slightly shifted element as a duplicate at a relaxed threshold', () => {
      const engine = new FingerprintEngine();
      const a = createElement({
        elementId: 'element-a',
        bounds: { left: 100, top: 200, right: 300, bottom: 260 },
      });
      const b = createElement({
        elementId: 'element-b',
        bounds: { left: 105, top: 200, right: 305, bottom: 260 },
      });

      const isDuplicate = engine.isDuplicateElement(
        engine.fingerprintElement(a, [a]),
        engine.fingerprintElement(b, [b]),
        0.9,
      );

      expect(isDuplicate).toBe(true);
    });

    it('does not treat clearly different elements as duplicates', () => {
      const engine = new FingerprintEngine();
      const button = createElement({ elementId: 'element-a', className: 'android.widget.Button' });
      const label = createElement({
        elementId: 'element-b',
        className: 'android.widget.TextView',
        text: 'Different',
        resourceId: '',
        clickable: false,
      });

      const isDuplicate = engine.isDuplicateElement(
        engine.fingerprintElement(button, [button]),
        engine.fingerprintElement(label, [label]),
      );

      expect(isDuplicate).toBe(false);
    });
  });

  describe('fingerprintScreen', () => {
    it('is order-independent: the same set of element fingerprints yields the same hash regardless of input order', () => {
      const engine = new FingerprintEngine();
      const screen = createScreen();
      const elementA = createElement({ elementId: 'element-a', text: 'A' });
      const elementB = createElement({ elementId: 'element-b', text: 'B' });
      const fingerprintA = engine.fingerprintElement(elementA, [elementA]);
      const fingerprintB = engine.fingerprintElement(elementB, [elementB]);

      const screenFingerprint1 = engine.fingerprintScreen(screen, [fingerprintA, fingerprintB]);
      const screenFingerprint2 = engine.fingerprintScreen(screen, [fingerprintB, fingerprintA]);

      expect(screenFingerprint1.hash).toBe(screenFingerprint2.hash);
    });

    it('produces a different hash when the element set differs', () => {
      const engine = new FingerprintEngine();
      const screen = createScreen();
      const elementA = createElement({ elementId: 'element-a', text: 'A' });
      const elementC = createElement({ elementId: 'element-c', text: 'C' });
      const fingerprintA = engine.fingerprintElement(elementA, [elementA]);
      const fingerprintC = engine.fingerprintElement(elementC, [elementC]);

      const screenFingerprint1 = engine.fingerprintScreen(screen, [fingerprintA]);
      const screenFingerprint2 = engine.fingerprintScreen(screen, [fingerprintA, fingerprintC]);

      expect(screenFingerprint1.hash).not.toBe(screenFingerprint2.hash);
    });
  });

  describe('screenSimilarity', () => {
    it('returns 1 for two screens with the same package, activity, and elements', () => {
      const engine = new FingerprintEngine();
      const element = createElement();
      const fingerprint = engine.fingerprintElement(element, [element]);
      const screenA = engine.fingerprintScreen(createScreen({ screenId: 'screen-a' }), [
        fingerprint,
      ]);
      const screenB = engine.fingerprintScreen(createScreen({ screenId: 'screen-b' }), [
        fingerprint,
      ]);

      expect(engine.screenSimilarity(screenA, screenB)).toBe(1);
    });

    it('returns 0 when the package differs', () => {
      const engine = new FingerprintEngine();
      const element = createElement();
      const fingerprint = engine.fingerprintElement(element, [element]);
      const screenA = engine.fingerprintScreen(
        createScreen({ screenId: 'screen-a', packageName: 'com.example.app' }),
        [fingerprint],
      );
      const screenB = engine.fingerprintScreen(
        createScreen({ screenId: 'screen-b', packageName: 'com.other.app' }),
        [fingerprint],
      );

      expect(engine.screenSimilarity(screenA, screenB)).toBe(0);
    });

    it('returns a partial score when the package matches but the elements differ', () => {
      const engine = new FingerprintEngine();
      const elementA = createElement({ elementId: 'element-a' });
      const elementB = createElement({ elementId: 'element-b', text: 'Different' });
      const screenA = engine.fingerprintScreen(createScreen({ screenId: 'screen-a' }), [
        engine.fingerprintElement(elementA, [elementA]),
      ]);
      const screenB = engine.fingerprintScreen(createScreen({ screenId: 'screen-b' }), [
        engine.fingerprintElement(elementB, [elementB]),
      ]);

      const score = engine.screenSimilarity(screenA, screenB);

      expect(score).toBeGreaterThanOrEqual(0.3); // activity still matches
      expect(score).toBeLessThan(1);
    });
  });

  describe('isDuplicateScreen', () => {
    it('treats two captures of the same screen as duplicates', () => {
      const engine = new FingerprintEngine();
      const element = createElement();
      const fingerprint = engine.fingerprintElement(element, [element]);
      const screenA = engine.fingerprintScreen(createScreen({ screenId: 'screen-a' }), [
        fingerprint,
      ]);
      const screenB = engine.fingerprintScreen(createScreen({ screenId: 'screen-b' }), [
        fingerprint,
      ]);

      expect(engine.isDuplicateScreen(screenA, screenB)).toBe(true);
    });

    it('does not treat screens from different packages as duplicates', () => {
      const engine = new FingerprintEngine();
      const element = createElement();
      const fingerprint = engine.fingerprintElement(element, [element]);
      const screenA = engine.fingerprintScreen(
        createScreen({ screenId: 'screen-a', packageName: 'com.example.app' }),
        [fingerprint],
      );
      const screenB = engine.fingerprintScreen(
        createScreen({ screenId: 'screen-b', packageName: 'com.other.app' }),
        [fingerprint],
      );

      expect(engine.isDuplicateScreen(screenA, screenB)).toBe(false);
    });
  });
});
