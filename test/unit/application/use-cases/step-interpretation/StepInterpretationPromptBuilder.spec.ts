import { StepInterpretationPromptBuilder } from '../../../../../src/application/use-cases/step-interpretation/StepInterpretationPromptBuilder';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
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

describe('StepInterpretationPromptBuilder', () => {
  it('includes the step description, expected result, and every candidate with its index', () => {
    const builder = new StepInterpretationPromptBuilder();
    const candidateA = createElement({ elementId: 'a', text: 'Mobile Number' });
    const candidateB = createElement({ elementId: 'b', text: 'Login' });

    const prompt = builder.build({
      stepDescription: 'click login button',
      expectedResult: 'user should get logged in',
      candidateElements: [candidateA, candidateB],
    });

    expect(prompt).toContain('Step: "click login button"');
    expect(prompt).toContain('"user should get logged in"');
    expect(prompt).toContain('0: class=android.widget.Button, text="Mobile Number"');
    expect(prompt).toContain('1: class=android.widget.Button, text="Login"');
    expect(prompt).toContain('"applicable": boolean');
    expect(prompt).toContain('"expectedResultCheck"');
  });

  it('produces a prompt even with zero candidates', () => {
    const builder = new StepInterpretationPromptBuilder();

    const prompt = builder.build({
      stepDescription: 'enter the URL of betway-https://synapse-uat.betway.com.gh/',
      expectedResult: 'Betway Application must be accessible',
      candidateElements: [],
    });

    expect(prompt).toContain('(no elements found)');
    expect(prompt).toContain('applicable');
  });
});
