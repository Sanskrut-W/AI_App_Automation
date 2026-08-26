import { Element } from '../../../core/entities/Element';
import { ActionType } from '../../../core/enums/ActionType';
import { LocatorStrategy } from '../../../core/enums/LocatorStrategy';
import { TestStep } from '../../../core/value-objects/TestStep';
import { ElementLocator } from '../../../core/value-objects/ElementLocator';

/**
 * Shared TestStep construction helpers, used by every test-case generator (hamburger-menu, login,
 * sign-up, manual) so the generated step shape — and the elementId/locator bookkeeping locator
 * healing depends on — stays consistent no matter which generator produced it. Extracted from
 * SignUpTestCaseGenerator, which was the first to need all of them.
 */

export function verifyStep(
  stepNumber: number,
  locator: ElementLocator,
  element: Element,
  expectedResult: string,
): TestStep {
  return {
    stepNumber,
    action: ActionType.VERIFY_ELEMENT_EXISTS,
    targetLocator: locator,
    elementId: element.elementId,
    value: null,
    direction: null,
    durationMs: null,
    expectedResult,
  };
}

export function clickStep(
  stepNumber: number,
  locator: ElementLocator,
  element: Element,
  expectedResult: string,
): TestStep {
  return {
    stepNumber,
    action: ActionType.CLICK,
    targetLocator: locator,
    elementId: element.elementId,
    value: null,
    direction: null,
    durationMs: null,
    expectedResult,
  };
}

export function typeStep(
  stepNumber: number,
  locator: ElementLocator,
  element: Element,
  value: string,
  expectedResult: string,
): TestStep {
  return {
    stepNumber,
    action: ActionType.TYPE,
    targetLocator: locator,
    elementId: element.elementId,
    value,
    direction: null,
    durationMs: null,
    expectedResult,
  };
}

export function scrollStep(
  stepNumber: number,
  direction: string,
  expectedResult: string,
): TestStep {
  return {
    stepNumber,
    action: ActionType.SCROLL,
    targetLocator: null,
    elementId: null,
    value: null,
    direction,
    durationMs: null,
    expectedResult,
  };
}

export function waitStep(stepNumber: number, durationMs: number, expectedResult: string): TestStep {
  return {
    stepNumber,
    action: ActionType.WAIT,
    targetLocator: null,
    elementId: null,
    value: null,
    direction: null,
    durationMs,
    expectedResult,
  };
}

/** The element's own highest-priority locator candidate. */
export function toLocator(element: Element): ElementLocator {
  const [best] = element.locators;
  return { strategy: best.strategy, value: best.value };
}

/** Forces a specific locator strategy when the element's own highest-priority candidate isn't
 * trustworthy for the action being performed (see SignUpTestCaseGenerator's KYC-screen locator
 * choices for two concrete, live-verified examples: forcing accessibility-id for custom
 * popup-list items whose coordinate taps don't reliably register, and forcing coordinates for
 * spinners whose "best" candidate would otherwise bake in whatever value happened to be selected
 * at capture time). Falls back to the element's own best locator if the requested strategy isn't
 * one of its candidates. */
export function toLocatorForStrategy(element: Element, strategy: LocatorStrategy): ElementLocator {
  const candidate = element.locators.find((locator) => locator.strategy === strategy);
  return candidate ? { strategy: candidate.strategy, value: candidate.value } : toLocator(element);
}
