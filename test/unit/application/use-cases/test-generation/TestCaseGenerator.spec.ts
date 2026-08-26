import { TestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/TestCaseGenerator';
import { IElementRepository } from '../../../../../src/application/interfaces/repositories/IElementRepository';
import { IIdGenerator } from '../../../../../src/shared/id/IIdGenerator';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { TestCaseGenerationError } from '../../../../../src/core/errors/TestCaseGenerationError';
import { ScreenAnalysisResult } from '../../../../../src/application/dto/ScreenAnalysisResult';
import { createMockLogger } from '../../../support/createMockLogger';

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

const ANALYSIS: ScreenAnalysisResult = {
  screenName: 'Home',
  screenPurpose: 'Lets the user perform a calculation.',
  navigationOptions: ['Settings'],
  importantElements: ['Calculate button'],
  suggestedTestAreas: ['Division by zero'],
};

const APP_VERSION = { appVersionName: '1.0.0', appVersionCode: '1' };

function createMocks() {
  const elementRepository: jest.Mocked<IElementRepository> = {
    add: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    search: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const idGenerator: jest.Mocked<IIdGenerator> = {
    generate: jest.fn().mockReturnValue('test-case-1'),
  };
  const logger = createMockLogger();

  return { elementRepository, idGenerator, logger };
}

function createGenerator(
  mocks: ReturnType<typeof createMocks>,
  options: ConstructorParameters<typeof TestCaseGenerator>[3] = {},
) {
  return new TestCaseGenerator(mocks.elementRepository, mocks.idGenerator, mocks.logger, options);
}

describe('TestCaseGenerator', () => {
  it('matches an important element description to a real clickable element and generates verify+click steps', async () => {
    const mocks = createMocks();
    const button = createElement();
    mocks.elementRepository.search.mockResolvedValue([button]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: ANALYSIS,
      ...APP_VERSION,
    });

    expect(result.isOk()).toBe(true);
    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);

    const testCase = testCases[0];
    expect(testCase.testCaseId).toBe('test-case-1');
    expect(testCase.screenId).toBe('screen-1');
    expect(testCase.title).toBe('Home: Calculate button');
    expect(testCase.description).toBe('Lets the user perform a calculation.');
    expect(testCase.tags).toEqual(['Division by zero']);
    expect(testCase.appVersionName).toBe('1.0.0');
    expect(testCase.appVersionCode).toBe('1');

    expect(testCase.steps).toHaveLength(2);
    expect(testCase.steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[0].targetLocator).toEqual({
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/btnCalculate',
    });
    expect(testCase.steps[0].elementId).toBe('element-1');
    expect(testCase.steps[1].action).toBe(ActionType.CLICK);
    expect(testCase.steps[1].targetLocator).toEqual(testCase.steps[0].targetLocator);
    expect(testCase.steps[1].elementId).toBe('element-1');
    expect(mocks.elementRepository.search).toHaveBeenCalledWith({ screenId: 'screen-1' });
  });

  it('generates verify+type steps for a matched text-input element', async () => {
    const mocks = createMocks();
    const input = createElement({
      elementId: 'element-2',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/amountInput',
      contentDescription: 'Amount input',
      clickable: true,
      locators: [
        { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Amount input', priority: 2 },
      ],
    });
    mocks.elementRepository.search.mockResolvedValue([input]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: { ...ANALYSIS, importantElements: ['Amount input field'] },
      ...APP_VERSION,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(2);
    expect(testCase.steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[1].action).toBe(ActionType.TYPE);
    expect(testCase.steps[1].value).toBe('Test123');
  });

  it('generates only a verify step for a matched non-clickable, non-input element', async () => {
    const mocks = createMocks();
    const label = createElement({
      elementId: 'element-3',
      className: 'android.widget.TextView',
      text: 'Result display',
      resourceId: '',
      clickable: false,
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });
    mocks.elementRepository.search.mockResolvedValue([label]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: { ...ANALYSIS, importantElements: ['Result display'] },
      ...APP_VERSION,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(1);
    expect(testCase.steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
  });

  it('skips important element descriptions that do not match any real element', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockResolvedValue([createElement()]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: { ...ANALYSIS, importantElements: ['Completely unrelated widget'] },
      ...APP_VERSION,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });

  it('generates one test case per matched important element', async () => {
    const mocks = createMocks();
    const clearButton = createElement({
      elementId: 'element-2',
      text: '',
      resourceId: '',
      contentDescription: 'Clear input',
      locators: [{ strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Clear input', priority: 2 }],
    });
    mocks.elementRepository.search.mockResolvedValue([createElement(), clearButton]);
    mocks.idGenerator.generate
      .mockReturnValueOnce('test-case-1')
      .mockReturnValueOnce('test-case-2');
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: { ...ANALYSIS, importantElements: ['Calculate button', 'Clear input'] },
      ...APP_VERSION,
    });

    const testCases = result.unwrap();
    expect(testCases).toHaveLength(2);
    expect(testCases.map((tc) => tc.testCaseId)).toEqual(['test-case-1', 'test-case-2']);
    expect(testCases[0].title).toContain('Calculate button');
    expect(testCases[0].steps[0].targetLocator).toEqual({
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/btnCalculate',
    });
    expect(testCases[1].title).toContain('Clear input');
    expect(testCases[1].steps[0].targetLocator).toEqual({
      strategy: LocatorStrategy.ACCESSIBILITY_ID,
      value: 'Clear input',
    });
  });

  it('excludes elements with no locators from matching candidates', async () => {
    const mocks = createMocks();
    const noLocatorElement = createElement({ locators: [] });
    mocks.elementRepository.search.mockResolvedValue([noLocatorElement]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: ANALYSIS,
      ...APP_VERSION,
    });

    expect(result.unwrap()).toEqual([]);
  });

  it('returns a TestCaseGenerationError when the element repository fails', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockRejectedValue(new Error('disk read error'));
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: ANALYSIS,
      ...APP_VERSION,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(TestCaseGenerationError);
    expect(result.unwrapErr().message).toMatch(/disk read error/);
  });

  it('returns an empty array when there are no important elements to match', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockResolvedValue([createElement()]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      screenId: 'screen-1',
      screenAnalysis: { ...ANALYSIS, importantElements: [] },
      ...APP_VERSION,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });
});
