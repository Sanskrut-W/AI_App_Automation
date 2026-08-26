import { TestCase, TestCaseProps } from '../../../../src/core/entities/TestCase';
import { ActionType } from '../../../../src/core/enums/ActionType';
import { TestPriority } from '../../../../src/core/enums/TestPriority';
import { LocatorStrategy } from '../../../../src/core/enums/LocatorStrategy';

const VALID_PROPS: TestCaseProps = {
  testCaseId: 'test-case-1',
  screenId: 'screen-1',
  title: 'Home: Calculate button',
  description: 'Lets the user perform a calculation.',
  steps: [
    {
      stepNumber: 1,
      action: ActionType.VERIFY_ELEMENT_EXISTS,
      targetLocator: {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/btnCalculate',
      },
      elementId: 'element-1',
      value: null,
      direction: null,
      durationMs: null,
      expectedResult: 'Calculate button is present on the screen.',
    },
  ],
  priority: TestPriority.MEDIUM,
  tags: ['Division by zero'],
  appVersionName: '1.0.0',
  appVersionCode: '1',
};

describe('TestCase', () => {
  it('constructs a test case with all provided fields', () => {
    const testCase = new TestCase(VALID_PROPS);

    expect(testCase.testCaseId).toBe('test-case-1');
    expect(testCase.screenId).toBe('screen-1');
    expect(testCase.title).toBe(VALID_PROPS.title);
    expect(testCase.steps).toEqual(VALID_PROPS.steps);
    expect(testCase.priority).toBe(TestPriority.MEDIUM);
    expect(testCase.tags).toEqual(['Division by zero']);
    expect(testCase.appVersionName).toBe('1.0.0');
    expect(testCase.appVersionCode).toBe('1');
  });

  it('leaves sequence undefined when not provided', () => {
    const testCase = new TestCase(VALID_PROPS);

    expect(testCase.sequence).toBeUndefined();
  });

  it('carries an explicit sequence value when provided', () => {
    const testCase = new TestCase({ ...VALID_PROPS, sequence: 4 });

    expect(testCase.sequence).toBe(4);
  });

  it('throws when testCaseId is empty', () => {
    expect(() => new TestCase({ ...VALID_PROPS, testCaseId: '' })).toThrow(/non-empty testCaseId/);
  });

  it('throws when screenId is empty', () => {
    expect(() => new TestCase({ ...VALID_PROPS, screenId: '' })).toThrow(/non-empty screenId/);
  });
});
