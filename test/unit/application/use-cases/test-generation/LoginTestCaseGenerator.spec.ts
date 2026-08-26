import { LoginTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/LoginTestCaseGenerator';
import { IElementRepository } from '../../../../../src/application/interfaces/repositories/IElementRepository';
import { IIdGenerator } from '../../../../../src/shared/id/IIdGenerator';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { NavigationGraph } from '../../../../../src/application/dto/NavigationGraph';
import { createMockLogger } from '../../../support/createMockLogger';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'login-screen',
    className: 'android.widget.EditText',
    text: '',
    resourceId: 'com.example.app:id/mobile',
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
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
    ],
    ...overrides,
  });
}

const APP_VERSION = { appVersionName: '1.0.0', appVersionCode: '1' };
const CREDENTIALS = { mobileNumber: '0000000000', password: 'fake-password' };

const LOGIN_TRIGGER = createElement({
  elementId: 'trigger-1',
  screenId: 'home-screen',
  className: 'android.widget.Button',
  text: 'Log In',
  resourceId: 'com.example.app:id/loginButton',
  locators: [
    { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/loginButton', priority: 1 },
  ],
});

function createGraph(overrides: Partial<NavigationGraph> = {}): NavigationGraph {
  return {
    rootScreenId: 'home-screen',
    screenIds: ['home-screen', 'login-screen'],
    edges: [{ fromScreenId: 'home-screen', toScreenId: 'login-screen', elementId: 'trigger-1' }],
    ...overrides,
  };
}

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

function createGenerator(mocks: ReturnType<typeof createMocks>) {
  return new LoginTestCaseGenerator(mocks.elementRepository, mocks.idGenerator, mocks.logger);
}

describe('LoginTestCaseGenerator', () => {
  it('finds the login form and generates a full open+fill+submit test case', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(LOGIN_TRIGGER);
    const mobileInput = createElement({ elementId: 'mobile-1' });
    const passwordInput = createElement({
      elementId: 'password-1',
      resourceId: 'com.example.app:id/password',
      isPassword: true,
      bounds: { left: 0, top: 400, right: 100, bottom: 450 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/password',
          priority: 1,
        },
      ],
    });
    const submitButton = createElement({
      elementId: 'submit-1',
      className: 'android.widget.Button',
      text: 'Log In',
      resourceId: 'com.example.app:id/submitLogin',
      bounds: { left: 0, top: 800, right: 100, bottom: 850 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/submitLogin',
          priority: 1,
        },
      ],
    });
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'login-screen') return [mobileInput, passwordInput, submitButton];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    expect(result.isOk()).toBe(true);
    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);
    expect(mocks.elementRepository.search).toHaveBeenCalledWith({ screenId: 'login-screen' });

    const testCase = testCases[0];
    expect(testCase.testCaseId).toBe('test-case-1');
    expect(testCase.title).toBe('Login: valid credentials');
    expect(testCase.tags).toEqual(['login']);
    expect(testCase.priority).toBe('high');
    expect(testCase.appVersionName).toBe('1.0.0');
    expect(testCase.appVersionCode).toBe('1');

    expect(testCase.steps).toHaveLength(11);
    expect(testCase.steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[0].elementId).toBe('trigger-1');
    expect(testCase.steps[1].action).toBe(ActionType.CLICK);
    expect(testCase.steps[1].elementId).toBe('trigger-1');
    expect(testCase.steps[2].action).toBe(ActionType.WAIT);
    expect(testCase.steps[3].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[3].elementId).toBe('mobile-1');
    expect(testCase.steps[4].action).toBe(ActionType.CLICK);
    expect(testCase.steps[4].elementId).toBe('mobile-1');
    expect(testCase.steps[5].action).toBe(ActionType.TYPE);
    expect(testCase.steps[5].elementId).toBe('mobile-1');
    expect(testCase.steps[5].value).toBe('0000000000');
    expect(testCase.steps[6].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[6].elementId).toBe('password-1');
    expect(testCase.steps[7].action).toBe(ActionType.CLICK);
    expect(testCase.steps[7].elementId).toBe('password-1');
    expect(testCase.steps[8].action).toBe(ActionType.TYPE);
    expect(testCase.steps[8].elementId).toBe('password-1');
    expect(testCase.steps[8].value).toBe('fake-password');
    expect(testCase.steps[9].action).toBe(ActionType.CLICK);
    expect(testCase.steps[9].elementId).toBe('submit-1');
    expect(testCase.steps[10].action).toBe(ActionType.WAIT);
  });

  it('does not mistake a sibling "login"-prefixed decoy element (e.g. Forgot Password) for the submit button', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(LOGIN_TRIGGER);
    const mobileInput = createElement({ elementId: 'mobile-1' });
    const passwordInput = createElement({
      elementId: 'password-1',
      resourceId: 'com.example.app:id/password',
      isPassword: true,
      bounds: { left: 0, top: 400, right: 100, bottom: 450 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/password',
          priority: 1,
        },
      ],
    });
    // A real-world login screen conventionally prefixes every sibling field's resourceId with
    // "login", so a naive resourceId-substring check would wrongly match this decoy before ever
    // reaching the real submit button below it.
    const forgotPasswordLink = createElement({
      elementId: 'forgot-password-1',
      className: 'android.widget.TextView',
      text: 'Forgot Password?',
      resourceId: 'com.example.app:id/loginForgotPassword',
      bounds: { left: 0, top: 500, right: 100, bottom: 550 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/loginForgotPassword',
          priority: 1,
        },
      ],
    });
    const submitButton = createElement({
      elementId: 'submit-1',
      className: 'android.widget.TextView',
      text: 'Log In',
      resourceId: 'com.example.app:id/loginSignIn',
      bounds: { left: 0, top: 800, right: 100, bottom: 850 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/loginSignIn',
          priority: 1,
        },
      ],
    });
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'login-screen') {
        return [mobileInput, passwordInput, forgotPasswordLink, submitButton];
      }
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(11);
    expect(testCase.steps[9].action).toBe(ActionType.CLICK);
    expect(testCase.steps[9].elementId).toBe('submit-1');
  });

  it('does not mistake the screen title for the submit button when both share the exact "Log In" label', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(LOGIN_TRIGGER);
    const mobileInput = createElement({ elementId: 'mobile-1' });
    const passwordInput = createElement({
      elementId: 'password-1',
      resourceId: 'com.example.app:id/password',
      isPassword: true,
      bounds: { left: 0, top: 400, right: 100, bottom: 450 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/password',
          priority: 1,
        },
      ],
    });
    // Observed on the real Betway ZA login screen: the screen's own heading is a clickable
    // TextView with the identical "Log In" text as the real submit button, and appears BEFORE it
    // in the element list â€” an exact-text-only match would grab this instead.
    const screenTitle = createElement({
      elementId: 'title-1',
      className: 'android.widget.TextView',
      text: 'Log In',
      resourceId: 'com.example.app:id/loginMainTitle',
      bounds: { left: 0, top: 50, right: 100, bottom: 100 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/loginMainTitle',
          priority: 1,
        },
      ],
    });
    const submitButton = createElement({
      elementId: 'submit-1',
      className: 'android.widget.TextView',
      text: 'Log In',
      resourceId: 'com.example.app:id/loginSignIn',
      bounds: { left: 0, top: 800, right: 100, bottom: 850 },
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/loginSignIn',
          priority: 1,
        },
      ],
    });
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'login-screen') {
        return [screenTitle, mobileInput, passwordInput, submitButton];
      }
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(11);
    expect(testCase.steps[9].action).toBe(ActionType.CLICK);
    expect(testCase.steps[9].elementId).toBe('submit-1');
  });

  it('distinguishes the mobile input from the password input via isPassword, regardless of repository order', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(LOGIN_TRIGGER);
    const passwordInput = createElement({
      elementId: 'password-1',
      resourceId: 'com.example.app:id/password',
      isPassword: true,
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/password',
          priority: 1,
        },
      ],
    });
    const mobileInput = createElement({ elementId: 'mobile-1' });
    // Password listed FIRST in the repository's return order.
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'login-screen') return [passwordInput, mobileInput];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps[5].elementId).toBe('mobile-1');
    expect(testCase.steps[5].value).toBe('0000000000');
    expect(testCase.steps[8].elementId).toBe('password-1');
    expect(testCase.steps[8].value).toBe('fake-password');
  });

  it('generates a fill-only test case (no submit step) when no submit button is confidently identified', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(LOGIN_TRIGGER);
    const mobileInput = createElement({ elementId: 'mobile-1' });
    const passwordInput = createElement({
      elementId: 'password-1',
      resourceId: 'com.example.app:id/password',
      isPassword: true,
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/password',
          priority: 1,
        },
      ],
    });
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'login-screen') return [mobileInput, passwordInput];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(9);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'No submit button was confidently identified on the login form; the generated test case will fill the form but not submit it.',
      expect.objectContaining({ screenId: 'login-screen' }),
    );
  });

  it('returns an empty array (not an error) when no login trigger is found', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(
      createElement({ elementId: 'element-9', text: 'Continue' }),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.elementRepository.search).not.toHaveBeenCalled();
  });

  it('returns an empty array (not an error) when the login form has no recognizable mobile/password inputs', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(LOGIN_TRIGGER);
    mocks.elementRepository.search.mockResolvedValue([]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
  });

  it('returns a TestCaseGenerationError when the element repository fails', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockRejectedValue(new Error('disk read error'));
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph(),
      ...APP_VERSION,
      ...CREDENTIALS,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/disk read error/);
  });
});
