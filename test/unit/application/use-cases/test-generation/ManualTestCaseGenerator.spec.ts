import { ManualTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/ManualTestCaseGenerator';
import { IElementRepository } from '../../../../../src/application/interfaces/repositories/IElementRepository';
import { IScreenRepository } from '../../../../../src/application/interfaces/repositories/IScreenRepository';
import { IStepInterpreter } from '../../../../../src/application/interfaces/ai/IStepInterpreter';
import { IIdGenerator } from '../../../../../src/shared/id/IIdGenerator';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { Screen, ScreenProps } from '../../../../../src/core/entities/Screen';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { NavigationGraph } from '../../../../../src/application/dto/NavigationGraph';
import { StepInterpretationResult } from '../../../../../src/application/dto/StepInterpretationResult';
import { StepInterpretationError } from '../../../../../src/core/errors/StepInterpretationError';
import { Result } from '../../../../../src/shared/result/Result';
import { createMockLogger } from '../../../support/createMockLogger';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'home-screen',
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

function createScreen(overrides: Partial<ScreenProps> = {}): Screen {
  return new Screen({
    screenId: 'home-screen',
    screenName: 'Home',
    screenshotPath: '/artifacts/apps/com.example.app/screenshots/home-screen.png',
    xmlPath: '/artifacts/apps/com.example.app/xml-dumps/home-screen.xml',
    packageName: 'com.example.app',
    activityName: '.MainActivity',
    parentScreenId: null,
    navigationPath: ['home-screen'],
    discoveredAt: '2026-01-01T00:00:00.000Z',
    structuralHash: 'hash-1',
    ...overrides,
  });
}

const APP_VERSION = { appVersionName: '1.0.0', appVersionCode: '1' };
const TEST_ACCOUNT = { mobileNumber: '0000000000', password: 'fake-password' };

function createGraph(overrides: Partial<NavigationGraph> = {}): NavigationGraph {
  return { rootScreenId: 'home-screen', screenIds: ['home-screen'], edges: [], ...overrides };
}

function createMocks() {
  const elementRepository: jest.Mocked<IElementRepository> = {
    add: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const screenRepository: jest.Mocked<IScreenRepository> = {
    add: jest.fn(),
    update: jest.fn(),
    findById: jest.fn().mockResolvedValue(createScreen()),
    findAll: jest.fn(),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const stepInterpreter: jest.Mocked<IStepInterpreter> = { interpret: jest.fn() };
  const idGenerator: jest.Mocked<IIdGenerator> = {
    generate: jest.fn().mockReturnValue('test-case-1'),
  };
  const logger = createMockLogger();

  return { elementRepository, screenRepository, stepInterpreter, idGenerator, logger };
}

function createGenerator(mocks: ReturnType<typeof createMocks>) {
  return new ManualTestCaseGenerator(
    mocks.elementRepository,
    mocks.screenRepository,
    mocks.stepInterpreter,
    mocks.idGenerator,
    mocks.logger,
  );
}

function applicableResult(
  overrides: Partial<StepInterpretationResult> = {},
): StepInterpretationResult {
  return {
    applicable: true,
    reason: null,
    actions: [
      {
        action: 'click',
        candidateIndex: 0,
        fieldType: 'none',
        literalValue: null,
        direction: null,
      },
    ],
    expectedResultCheck: null,
    ...overrides,
  };
}

describe('ManualTestCaseGenerator', () => {
  it('generates verify+click steps for a single click action', async () => {
    const mocks = createMocks();
    const loginButton = createElement();
    mocks.elementRepository.search.mockResolvedValue([loginButton]);
    mocks.stepInterpreter.interpret.mockResolvedValue(Result.ok(applicableResult()));
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Verify login button opens login form',
          objective: 'Check the login button works',
          steps: [
            {
              stepNumber: 1,
              description: 'click login button',
              expectedResult: 'Login form opens',
            },
          ],
        },
      ],
    });

    expect(result.isOk()).toBe(true);
    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);
    expect(testCases[0].title).toBe('Verify login button opens login form');
    expect(testCases[0].steps).toHaveLength(2);
    expect(testCases[0].steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCases[0].steps[1].action).toBe(ActionType.CLICK);
    expect(testCases[0].steps[1].expectedResult).toBe('Login form opens');
  });

  it('splits a compound step into multiple actions (scroll then click)', async () => {
    const mocks = createMocks();
    const loginLink = createElement({ elementId: 'login-link' });
    mocks.elementRepository.search.mockResolvedValue([loginLink]);
    mocks.stepInterpreter.interpret.mockResolvedValue(
      Result.ok(
        applicableResult({
          actions: [
            {
              action: 'scroll',
              candidateIndex: null,
              fieldType: 'none',
              literalValue: null,
              direction: 'down',
            },
            {
              action: 'click',
              candidateIndex: 0,
              fieldType: 'none',
              literalValue: null,
              direction: null,
            },
          ],
        }),
      ),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login from signup popup',
          objective: '',
          steps: [
            {
              stepNumber: 1,
              description: 'scroll to bottom and click login button',
              expectedResult: 'login opens',
            },
          ],
        },
      ],
    });

    const steps = result.unwrap()[0].steps;
    expect(steps.map((s) => s.action)).toEqual([
      ActionType.SCROLL,
      ActionType.VERIFY_ELEMENT_EXISTS,
      ActionType.CLICK,
    ]);
    expect(steps[0].direction).toBe('down');
  });

  it('resolves mobileNumber/password field types to the real configured test account', async () => {
    const mocks = createMocks();
    const mobileInput = createElement({
      elementId: 'mobile-input',
      className: 'android.widget.EditText',
    });
    mocks.elementRepository.search.mockResolvedValue([mobileInput]);
    mocks.stepInterpreter.interpret.mockResolvedValue(
      Result.ok(
        applicableResult({
          actions: [
            {
              action: 'type',
              candidateIndex: 0,
              fieldType: 'mobileNumber',
              literalValue: null,
              direction: null,
            },
          ],
        }),
      ),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: TEST_ACCOUNT,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [
            { stepNumber: 1, description: 'enter mobile number', expectedResult: 'accepted' },
          ],
        },
      ],
    });

    const typeStep = result.unwrap()[0].steps.find((s) => s.action === ActionType.TYPE);
    expect(typeStep?.value).toBe('0000000000');
  });

  it('skips an action needing a test account when none is configured', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockResolvedValue([createElement()]);
    mocks.stepInterpreter.interpret.mockResolvedValue(
      Result.ok(
        applicableResult({
          actions: [
            {
              action: 'type',
              candidateIndex: 0,
              fieldType: 'password',
              literalValue: null,
              direction: null,
            },
          ],
        }),
      ),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [
            { stepNumber: 1, description: 'enter correct password', expectedResult: 'accepted' },
          ],
        },
      ],
    });

    // No steps could be generated at all for this test case (its only action was unresolvable) â€”
    // the whole test case is skipped rather than persisted empty.
    expect(result.unwrap()).toHaveLength(0);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'This step needs a real account password, but no test account is configured for this package',
    );
  });

  it('skips a step the interpreter marks as not applicable to this app', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockResolvedValue([createElement()]);
    mocks.stepInterpreter.interpret
      .mockResolvedValueOnce(
        Result.ok({
          applicable: false,
          reason: 'Native apps have no address bar.',
          actions: [],
          expectedResultCheck: null,
        }),
      )
      .mockResolvedValueOnce(Result.ok(applicableResult()));
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [
            {
              stepNumber: 1,
              description: 'Enter the URL of betway-https://...',
              expectedResult: 'App accessible',
            },
            { stepNumber: 2, description: 'click login button', expectedResult: 'login opens' },
          ],
        },
      ],
    });

    expect(result.unwrap()[0].steps).toHaveLength(2); // only the second, applicable step generated anything
  });

  it('advances the tracked screen via a matching navigation graph edge after a click', async () => {
    const mocks = createMocks();
    const loginButton = createElement({ elementId: 'login-button', screenId: 'home-screen' });
    const mobileInput = createElement({
      elementId: 'mobile-input',
      screenId: 'login-screen',
      className: 'android.widget.EditText',
    });
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'home-screen') return [loginButton];
      if (screenId === 'login-screen') return [mobileInput];
      return [];
    });
    mocks.screenRepository.findById.mockImplementation(async (screenId) =>
      createScreen({ screenId, screenshotPath: `/screens/${screenId}.png` }),
    );
    mocks.stepInterpreter.interpret
      .mockResolvedValueOnce(Result.ok(applicableResult())) // click login-button
      .mockResolvedValueOnce(
        Result.ok(
          applicableResult({
            actions: [
              {
                action: 'type',
                candidateIndex: 0,
                fieldType: 'mobileNumber',
                literalValue: null,
                direction: null,
              },
            ],
          }),
        ),
      );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph({
        edges: [
          { fromScreenId: 'home-screen', toScreenId: 'login-screen', elementId: 'login-button' },
        ],
      }),
      ...APP_VERSION,
      testAccount: TEST_ACCOUNT,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [
            { stepNumber: 1, description: 'click login button', expectedResult: 'login opens' },
            { stepNumber: 2, description: 'enter mobile number', expectedResult: 'accepted' },
          ],
        },
      ],
    });

    expect(mocks.elementRepository.search).toHaveBeenNthCalledWith(1, { screenId: 'home-screen' });
    expect(mocks.elementRepository.search).toHaveBeenNthCalledWith(2, { screenId: 'login-screen' });
    expect(result.unwrap()[0].steps.some((s) => s.action === ActionType.TYPE)).toBe(true);
  });

  it('falls back to a repository-wide search when the current screen has no elements at all', async () => {
    const mocks = createMocks();
    const fallbackElement = createElement({
      elementId: 'fallback-element',
      screenId: 'other-screen',
    });
    mocks.elementRepository.search.mockResolvedValue([]); // nothing scoped to the current screen
    mocks.elementRepository.findAll.mockResolvedValue([fallbackElement]);
    mocks.stepInterpreter.interpret.mockResolvedValue(Result.ok(applicableResult()));
    const generator = createGenerator(mocks);

    await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [{ stepNumber: 1, description: 'click login button', expectedResult: 'opens' }],
        },
      ],
    });

    expect(mocks.stepInterpreter.interpret).toHaveBeenCalledWith(
      expect.objectContaining({ candidateElements: [fallbackElement] }),
    );
  });

  it('appends a VERIFY_ELEMENT_EXISTS step for a confidently-resolved expectedResultCheck', async () => {
    const mocks = createMocks();
    const menuButton = createElement({ elementId: 'menu-button' });
    const menuItem = createElement({ elementId: 'menu-item', text: 'Promotions' });
    mocks.elementRepository.search.mockResolvedValue([menuButton, menuItem]);
    mocks.stepInterpreter.interpret.mockResolvedValue(
      Result.ok(
        applicableResult({
          expectedResultCheck: { candidateIndex: 1, confidence: 0.9 },
        }),
      ),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Menu',
          objective: '',
          steps: [
            {
              stepNumber: 1,
              description: 'click menu button',
              expectedResult: 'Menu shows Promotions',
            },
          ],
        },
      ],
    });

    const steps = result.unwrap()[0].steps;
    expect(steps[steps.length - 1]).toEqual(
      expect.objectContaining({ action: ActionType.VERIFY_ELEMENT_EXISTS, elementId: 'menu-item' }),
    );
  });

  it('skips a step entirely when interpretation itself fails, but continues with later steps', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockResolvedValue([createElement()]);
    mocks.stepInterpreter.interpret
      .mockResolvedValueOnce(Result.err(new StepInterpretationError('Gemini request failed')))
      .mockResolvedValueOnce(Result.ok(applicableResult()));
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [
            { stepNumber: 1, description: 'ambiguous step', expectedResult: 'x' },
            { stepNumber: 2, description: 'click login button', expectedResult: 'y' },
          ],
        },
      ],
    });

    expect(result.unwrap()[0].steps.length).toBeGreaterThan(0);
  });

  it('returns no test case when every step is unresolvable', async () => {
    const mocks = createMocks();
    mocks.elementRepository.search.mockResolvedValue([]);
    mocks.elementRepository.findAll.mockResolvedValue([]);
    mocks.stepInterpreter.interpret.mockResolvedValue(
      Result.ok(
        applicableResult({
          actions: [
            {
              action: 'click',
              candidateIndex: null,
              fieldType: 'none',
              literalValue: null,
              direction: null,
            },
          ],
        }),
      ),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [{ stepNumber: 1, description: 'click something', expectedResult: 'x' }],
        },
      ],
    });

    expect(result.unwrap()).toEqual([]);
  });

  it('stops processing a test case (without throwing) when the currently-tracked screen cannot be found', async () => {
    const mocks = createMocks();
    mocks.screenRepository.findById.mockResolvedValue(null);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [{ stepNumber: 1, description: 'click login button', expectedResult: 'x' }],
        },
      ],
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.stepInterpreter.interpret).not.toHaveBeenCalled();
  });

  it('returns a TestCaseGenerationError when something throws unexpectedly', async () => {
    const mocks = createMocks();
    mocks.screenRepository.findById.mockRejectedValue(new Error('disk read error'));
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      testAccount: null,
      manualTestCases: [
        {
          testCaseName: 'Login',
          objective: '',
          steps: [{ stepNumber: 1, description: 'click login button', expectedResult: 'x' }],
        },
      ],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/disk read error/);
  });
});
