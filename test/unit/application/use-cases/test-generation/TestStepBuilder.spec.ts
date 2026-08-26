import {
  verifyStep,
  clickStep,
  typeStep,
  scrollStep,
  waitStep,
  toLocator,
  toLocatorForStrategy,
} from '../../../../../src/application/use-cases/test-generation/TestStepBuilder';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Login',
    resourceId: 'com.example.app:id/login',
    accessibilityId: '',
    contentDescription: '',
    bounds: { left: 0, top: 0, right: 100, bottom: 50 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: null,
    childElementIds: [],
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
    ],
    ...overrides,
  });
}

const LOCATOR = { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login' };

describe('TestStepBuilder', () => {
  it('builds a VERIFY_ELEMENT_EXISTS step', () => {
    const step = verifyStep(1, LOCATOR, createElement(), 'The element is present.');
    expect(step).toEqual({
      stepNumber: 1,
      action: ActionType.VERIFY_ELEMENT_EXISTS,
      targetLocator: LOCATOR,
      elementId: 'element-1',
      value: null,
      direction: null,
      durationMs: null,
      expectedResult: 'The element is present.',
    });
  });

  it('builds a CLICK step', () => {
    const step = clickStep(2, LOCATOR, createElement(), 'Tapping it does something.');
    expect(step.action).toBe(ActionType.CLICK);
    expect(step.value).toBeNull();
  });

  it('builds a TYPE step carrying the value', () => {
    const step = typeStep(3, LOCATOR, createElement(), 'hello', 'The value is entered.');
    expect(step.action).toBe(ActionType.TYPE);
    expect(step.value).toBe('hello');
  });

  it('builds a SCROLL step carrying the direction, with no locator/elementId', () => {
    const step = scrollStep(4, 'down', 'Scrolls to reveal more content.');
    expect(step.action).toBe(ActionType.SCROLL);
    expect(step.direction).toBe('down');
    expect(step.targetLocator).toBeNull();
    expect(step.elementId).toBeNull();
  });

  it('builds a WAIT step carrying the duration, with no locator/elementId', () => {
    const step = waitStep(5, 800, 'The screen settles.');
    expect(step.action).toBe(ActionType.WAIT);
    expect(step.durationMs).toBe(800);
    expect(step.targetLocator).toBeNull();
    expect(step.elementId).toBeNull();
  });

  describe('toLocator', () => {
    it("returns the element's own highest-priority locator candidate", () => {
      const element = createElement({
        locators: [
          { strategy: LocatorStrategy.RESOURCE_ID, value: 'id-1', priority: 1 },
          { strategy: LocatorStrategy.COORDINATES, value: '10,20', priority: 5 },
        ],
      });
      expect(toLocator(element)).toEqual({ strategy: LocatorStrategy.RESOURCE_ID, value: 'id-1' });
    });
  });

  describe('toLocatorForStrategy', () => {
    it('returns the requested strategy when the element has it as a candidate', () => {
      const element = createElement({
        locators: [
          { strategy: LocatorStrategy.RESOURCE_ID, value: 'id-1', priority: 1 },
          { strategy: LocatorStrategy.COORDINATES, value: '10,20', priority: 5 },
        ],
      });
      expect(toLocatorForStrategy(element, LocatorStrategy.COORDINATES)).toEqual({
        strategy: LocatorStrategy.COORDINATES,
        value: '10,20',
      });
    });

    it("falls back to the element's own best locator when the requested strategy isn't a candidate", () => {
      const element = createElement({
        locators: [{ strategy: LocatorStrategy.RESOURCE_ID, value: 'id-1', priority: 1 }],
      });
      expect(toLocatorForStrategy(element, LocatorStrategy.ACCESSIBILITY_ID)).toEqual({
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'id-1',
      });
    });
  });
});
