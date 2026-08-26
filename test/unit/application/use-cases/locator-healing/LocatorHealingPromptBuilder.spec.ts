import { LocatorHealingPromptBuilder } from '../../../../../src/application/use-cases/locator-healing/LocatorHealingPromptBuilder';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
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
    bounds: { left: 0, top: 0, right: 100, bottom: 50 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: null,
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

describe('LocatorHealingPromptBuilder', () => {
  it('describes the target element and every candidate with its index', () => {
    const builder = new LocatorHealingPromptBuilder();
    const target = createElement();
    const candidateA = createElement({ elementId: 'candidate-a', text: 'Calc' });
    const candidateB = createElement({ elementId: 'candidate-b', text: 'Calculate Now' });

    const prompt = builder.build(target, [candidateA, candidateB]);

    expect(prompt).toContain('class=android.widget.Button');
    expect(prompt).toContain('text="Calculate"');
    expect(prompt).toContain('0: class=android.widget.Button, text="Calc"');
    expect(prompt).toContain('1: class=android.widget.Button, text="Calculate Now"');
    expect(prompt).toContain('"matchIndex": number | null');
  });

  it('produces a prompt even with zero candidates', () => {
    const builder = new LocatorHealingPromptBuilder();

    const prompt = builder.build(createElement(), []);

    expect(prompt).toContain('matchIndex');
  });
});
