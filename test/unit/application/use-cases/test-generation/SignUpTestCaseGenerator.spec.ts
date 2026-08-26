import { SignUpTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/SignUpTestCaseGenerator';
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
    screenId: 'signup-screen',
    className: 'android.widget.EditText',
    text: '',
    resourceId: 'com.example.app:id/field',
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
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/field', priority: 1 },
    ],
    ...overrides,
  });
}

const APP_VERSION = { appVersionName: '1.0.0', appVersionCode: '1' };

/** The direct home-screen "Sign Up" button — per the real app, reached WITHOUT going through
 * Login at all. */
const SIGN_UP_TRIGGER = createElement({
  elementId: 'signup-trigger',
  screenId: 'home-screen',
  className: 'android.widget.TextView',
  text: 'Sign Up',
  resourceId: 'com.example.app:id/toolbarRegister',
  locators: [
    {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/toolbarRegister',
      priority: 1,
    },
  ],
});

function createGraph(overrides: Partial<NavigationGraph> = {}): NavigationGraph {
  return {
    rootScreenId: 'home-screen',
    screenIds: ['home-screen', 'signup-screen'],
    edges: [
      { fromScreenId: 'home-screen', toScreenId: 'signup-screen', elementId: 'signup-trigger' },
    ],
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
  // findKycExtension mints a fresh id per coordinate-free option copy BEFORE buildTestCase mints
  // the test case's own id, so a static return value would collide across all of them. Only the
  // very first call (relevant when no KYC data is present, so testCaseId is the only call at all)
  // needs to be the well-known 'test-case-1'.
  let idCallCount = 0;
  const idGenerator: jest.Mocked<IIdGenerator> = {
    generate: jest.fn().mockImplementation(() => {
      idCallCount += 1;
      return idCallCount === 1 ? 'test-case-1' : `generated-id-${idCallCount}`;
    }),
  };
  const logger = createMockLogger();

  return { elementRepository, idGenerator, logger };
}

function createGenerator(mocks: ReturnType<typeof createMocks>) {
  return new SignUpTestCaseGenerator(mocks.elementRepository, mocks.idGenerator, mocks.logger);
}

/** Mirrors the real Betway ZA sign-up form's field layout: a decoy element overlapping the mobile
 * number field (see SignUpTestCaseGenerator's OVERLAPPING_FIELD_THRESHOLD_PX comment), followed by
 * password/first-name/surname/email at realistic row spacing, plus a "Next" button. */
function createFormFields() {
  const mobileDecoy = createElement({
    elementId: 'mobile-decoy',
    resourceId: '',
    bounds: { left: 0, top: 622, right: 100, bottom: 727 },
    locators: [{ strategy: LocatorStrategy.XPATH_CLASS_INDEX, value: '/EditText[1]', priority: 4 }],
  });
  const mobileInput = createElement({
    elementId: 'mobile-1',
    resourceId: 'com.example.app:id/mobile',
    bounds: { left: 0, top: 648, right: 100, bottom: 755 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
    ],
  });
  const passwordInput = createElement({
    elementId: 'password-1',
    resourceId: 'com.example.app:id/password',
    isPassword: true,
    bounds: { left: 0, top: 755, right: 100, bottom: 866 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/password', priority: 1 },
    ],
  });
  const firstNameInput = createElement({
    elementId: 'first-name-1',
    resourceId: 'com.example.app:id/firstName',
    bounds: { left: 0, top: 895, right: 100, bottom: 1000 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/firstName', priority: 1 },
    ],
  });
  const surnameInput = createElement({
    elementId: 'surname-1',
    resourceId: 'com.example.app:id/surname',
    bounds: { left: 0, top: 1028, right: 100, bottom: 1139 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/surname', priority: 1 },
    ],
  });
  const emailInput = createElement({
    elementId: 'email-1',
    resourceId: 'com.example.app:id/email',
    bounds: { left: 0, top: 1168, right: 100, bottom: 1273 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/email', priority: 1 },
    ],
  });
  const nextButton = createElement({
    elementId: 'next-1',
    className: 'android.widget.Button',
    text: '',
    accessibilityId: 'Next',
    contentDescription: 'Next',
    resourceId: 'register-next',
    bounds: { left: 0, top: 1400, right: 100, bottom: 1450 },
    locators: [{ strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Next', priority: 2 }],
  });

  return {
    mobileDecoy,
    mobileInput,
    passwordInput,
    firstNameInput,
    surnameInput,
    emailInput,
    nextButton,
  };
}

/** Mirrors the real Betway ZA registration-details (KYC) screen, spread across the distinct
 * screenIds a live discovery run would actually persist them under: the KYC screen itself (spinners,
 * the two post-selection EditTexts, the checkbox), plus one screen per transient dropdown-open /
 * date-picker-open state. */
function createKycElements() {
  const idTypeSpinner = createElement({
    elementId: 'kyc-id-type-spinner',
    screenId: 'kyc-screen',
    className: 'android.widget.Spinner',
    text: 'Passport',
    resourceId: '',
    bounds: { left: 70, top: 622, right: 1010, bottom: 727 },
    locators: [
      {
        strategy: LocatorStrategy.XPATH_TEXT,
        value: '//android.widget.Spinner[@text="Passport"]',
        priority: 3,
      },
      { strategy: LocatorStrategy.COORDINATES, value: '540,674', priority: 5 },
    ],
  });
  const passportInput = createElement({
    elementId: 'kyc-passport-input',
    screenId: 'kyc-screen',
    className: 'android.widget.EditText',
    resourceId: 'ac0fa4d2-d5ed-455d-a079-182a88e529f4',
    bounds: { left: 68, top: 755, right: 1013, bottom: 866 },
    locators: [
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'ac0fa4d2-d5ed-455d-a079-182a88e529f4',
        priority: 1,
      },
      { strategy: LocatorStrategy.COORDINATES, value: '540,810', priority: 5 },
    ],
  });
  const dobInput = createElement({
    elementId: 'kyc-dob-input',
    screenId: 'kyc-screen',
    className: 'android.widget.EditText',
    resourceId: 'b1c2d3e4-1111-2222-3333-444455556666',
    bounds: { left: 68, top: 900, right: 1013, bottom: 1000 },
    locators: [
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'b1c2d3e4-1111-2222-3333-444455556666',
        priority: 1,
      },
      { strategy: LocatorStrategy.COORDINATES, value: '540,950', priority: 5 },
    ],
  });
  const sourceOfFundsSpinner = createElement({
    elementId: 'kyc-source-of-funds-spinner',
    screenId: 'kyc-screen',
    className: 'android.widget.Spinner',
    text: 'Salary',
    resourceId: '',
    bounds: { left: 70, top: 1015, right: 1010, bottom: 1120 },
    locators: [
      {
        strategy: LocatorStrategy.XPATH_TEXT,
        value: '//android.widget.Spinner[@text="Salary"]',
        priority: 3,
      },
      { strategy: LocatorStrategy.COORDINATES, value: '540,1067', priority: 5 },
    ],
  });
  const languageSpinner = createElement({
    elementId: 'kyc-language-spinner',
    screenId: 'kyc-screen',
    className: 'android.widget.Spinner',
    text: 'English',
    resourceId: '',
    bounds: { left: 70, top: 1200, right: 1010, bottom: 1305 },
    locators: [
      {
        strategy: LocatorStrategy.XPATH_TEXT,
        value: '//android.widget.Spinner[@text="English"]',
        priority: 3,
      },
      { strategy: LocatorStrategy.COORDINATES, value: '540,1252', priority: 5 },
    ],
  });
  const agreeCheckbox = createElement({
    elementId: 'kyc-agree-checkbox',
    screenId: 'kyc-screen',
    className: 'android.widget.CheckBox',
    text: 'Agree to all',
    resourceId: 'ff192699-0ac2-4533-a0e7-22951826bc07',
    bounds: { left: 68, top: 1301, right: 118, bottom: 1354 },
    locators: [
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'ff192699-0ac2-4533-a0e7-22951826bc07',
        priority: 1,
      },
      { strategy: LocatorStrategy.COORDINATES, value: '93,1327', priority: 5 },
    ],
  });

  const passportOption = createElement({
    elementId: 'kyc-passport-option',
    screenId: 'id-type-dropdown-open',
    className: 'android.view.View',
    text: '',
    accessibilityId: 'Passport',
    contentDescription: 'Passport',
    resourceId: 'pv_id_2_1',
    clickable: false,
    bounds: { left: 70, top: 837, right: 1008, bottom: 947 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'pv_id_2_1', priority: 1 },
      { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Passport', priority: 2 },
    ],
  });
  const salaryOption = createElement({
    elementId: 'kyc-salary-option',
    screenId: 'source-of-funds-dropdown-open',
    className: 'android.view.View',
    text: '',
    accessibilityId: 'Salary',
    contentDescription: 'Salary',
    resourceId: 'pv_id_3_0',
    clickable: false,
    bounds: { left: 70, top: 1139, right: 997, bottom: 1249 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'pv_id_3_0', priority: 1 },
      { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Salary', priority: 2 },
    ],
  });
  const englishOption = createElement({
    elementId: 'kyc-english-option',
    screenId: 'language-dropdown-open',
    className: 'android.view.View',
    text: '',
    accessibilityId: 'English',
    contentDescription: 'English',
    resourceId: 'pv_id_4_0',
    clickable: false,
    bounds: { left: 70, top: 1275, right: 1008, bottom: 1385 },
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'pv_id_4_0', priority: 1 },
      { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'English', priority: 2 },
    ],
  });

  const dayCells = Array.from({ length: 22 }, (_, index) =>
    createElement({
      elementId: `dob-day-cell-${index}`,
      screenId: 'dob-picker-open',
      className: 'android.view.View',
      text: '',
      resourceId: '',
      bounds: {
        left: (index % 7) * 130,
        top: 1050 + Math.floor(index / 7) * 140,
        right: (index % 7) * 130 + 120,
        bottom: 1050 + Math.floor(index / 7) * 140 + 120,
      },
      locators: [
        {
          strategy: LocatorStrategy.COORDINATES,
          value: `${index * 10},${1100 + index}`,
          priority: 5,
        },
      ],
    }),
  );

  return {
    idTypeSpinner,
    passportInput,
    dobInput,
    sourceOfFundsSpinner,
    languageSpinner,
    agreeCheckbox,
    passportOption,
    salaryOption,
    englishOption,
    dayCells,
    all: [
      idTypeSpinner,
      passportInput,
      dobInput,
      sourceOfFundsSpinner,
      languageSpinner,
      agreeCheckbox,
      passportOption,
      salaryOption,
      englishOption,
      ...dayCells,
    ],
  };
}

describe('SignUpTestCaseGenerator', () => {
  it('finds the direct home-screen sign-up trigger and generates an open+fill+next test case (no KYC data available)', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockImplementation(async (elementId) => {
      if (elementId === 'signup-trigger') return SIGN_UP_TRIGGER;
      return null;
    });
    const f = createFormFields();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'signup-screen') {
        return [
          f.mobileDecoy,
          f.mobileInput,
          f.passwordInput,
          f.firstNameInput,
          f.surnameInput,
          f.emailInput,
          f.nextButton,
        ];
      }
      return [];
    });
    mocks.elementRepository.findAll.mockResolvedValue([]);
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);
    expect(mocks.elementRepository.search).toHaveBeenCalledWith({ screenId: 'signup-screen' });

    const testCase = testCases[0];
    expect(testCase.testCaseId).toBe('test-case-1');
    expect(testCase.title).toBe('Sign up: random details');
    expect(testCase.tags).toEqual(['sign-up']);
    expect(testCase.priority).toBe('high');

    expect(testCase.steps).toHaveLength(21);
    expect(testCase.steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[0].elementId).toBe('signup-trigger');
    expect(testCase.steps[1].action).toBe(ActionType.CLICK);
    expect(testCase.steps[1].elementId).toBe('signup-trigger');
    expect(testCase.steps[2].action).toBe(ActionType.WAIT);

    // Mobile field: verify/click/type at steps 3-5, using the real mobile-1 element (not the decoy).
    expect(testCase.steps[3].elementId).toBe('mobile-1');
    expect(testCase.steps[4].elementId).toBe('mobile-1');
    expect(testCase.steps[5].elementId).toBe('mobile-1');
    expect(testCase.steps[5].action).toBe(ActionType.TYPE);
    expect(testCase.steps[5].value).toMatch(/^[678]\d{8}$/);

    // Password field: 6-8.
    expect(testCase.steps[8].elementId).toBe('password-1');
    expect(testCase.steps[8].action).toBe(ActionType.TYPE);
    expect((testCase.steps[8].value as string).length).toBeGreaterThanOrEqual(8);

    // First name: 9-11.
    expect(testCase.steps[11].elementId).toBe('first-name-1');

    // Surname: 12-14.
    expect(testCase.steps[14].elementId).toBe('surname-1');

    // Email: 15-17.
    expect(testCase.steps[17].elementId).toBe('email-1');
    expect(testCase.steps[17].value).toMatch(/^[a-z]+\.[a-z]+\d+@example\.com$/);

    // Next button: verify/click/wait at 18-20.
    expect(testCase.steps[18].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[18].elementId).toBe('next-1');
    expect(testCase.steps[19].action).toBe(ActionType.CLICK);
    expect(testCase.steps[19].elementId).toBe('next-1');
    expect(testCase.steps[20].action).toBe(ActionType.WAIT);

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Registration-details (KYC) screen data was not found; generating the sign-up test case up to "Next" only.',
    );
  });

  it('extends the test case with the full KYC flow when registration-details screen data is available', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockImplementation(async (elementId) => {
      if (elementId === 'signup-trigger') return SIGN_UP_TRIGGER;
      return null;
    });
    const f = createFormFields();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'signup-screen') {
        return [
          f.mobileInput,
          f.passwordInput,
          f.firstNameInput,
          f.surnameInput,
          f.emailInput,
          f.nextButton,
        ];
      }
      return [];
    });
    const kyc = createKycElements();
    mocks.elementRepository.findAll.mockResolvedValue(kyc.all);
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(21 + 30);

    const kycSteps = testCase.steps.slice(21);

    // ID Type: verify/click/wait at 0-2 (of the KYC slice), forced to the coordinates locator (not
    // the xpath-text candidate baking in the already-selected "Passport" value).
    expect(kycSteps[0].elementId).toBe('kyc-id-type-spinner');
    expect(kycSteps[0].targetLocator).toEqual({
      strategy: LocatorStrategy.COORDINATES,
      value: '540,674',
    });
    expect(kycSteps[1].action).toBe(ActionType.CLICK);
    expect(kycSteps[2].action).toBe(ActionType.WAIT);

    // Passport option: verify/click/wait at 3-5, forced to accessibility-id. The referenced
    // element is a freshly persisted COORDINATE-FREE copy (not the original 'kyc-passport-option'
    // id) — see persistCoordinateFreeCopy: dropdown options don't reliably respond to a raw
    // coordinate tap, so if accessibility-id ever needs healing, it must never be able to fall
    // back to the cheap coordinates self-heal path.
    expect(kycSteps[3].elementId).not.toBe('kyc-passport-option');
    expect(kycSteps[3].targetLocator).toEqual({
      strategy: LocatorStrategy.ACCESSIBILITY_ID,
      value: 'Passport',
    });
    expect(kycSteps[4].action).toBe(ActionType.CLICK);

    // Passport input: verify/click/type at 6-8.
    expect(kycSteps[6].elementId).toBe('kyc-passport-input');
    expect(kycSteps[8].action).toBe(ActionType.TYPE);
    expect(kycSteps[8].value).toMatch(/^[A-Z]\d{7}$/);

    // DOB input: verify/click/wait at 9-11.
    expect(kycSteps[9].elementId).toBe('kyc-dob-input');

    // DOB day cell: verify/click/wait at 12-14, forced to coordinates.
    expect(kycSteps[12].elementId).toMatch(/^dob-day-cell-/);
    expect(kycSteps[12].targetLocator?.strategy).toBe(LocatorStrategy.COORDINATES);
    expect(kycSteps[13].action).toBe(ActionType.CLICK);

    // Source of Funds spinner + Salary option: 15-20.
    expect(kycSteps[15].elementId).toBe('kyc-source-of-funds-spinner');
    expect(kycSteps[15].targetLocator).toEqual({
      strategy: LocatorStrategy.COORDINATES,
      value: '540,1067',
    });
    expect(kycSteps[18].elementId).not.toBe('kyc-salary-option');
    expect(kycSteps[18].targetLocator).toEqual({
      strategy: LocatorStrategy.ACCESSIBILITY_ID,
      value: 'Salary',
    });

    // Language spinner + English option: 21-26.
    expect(kycSteps[21].elementId).toBe('kyc-language-spinner');
    expect(kycSteps[21].targetLocator).toEqual({
      strategy: LocatorStrategy.COORDINATES,
      value: '540,1252',
    });
    expect(kycSteps[24].elementId).not.toBe('kyc-english-option');
    expect(kycSteps[24].targetLocator).toEqual({
      strategy: LocatorStrategy.ACCESSIBILITY_ID,
      value: 'English',
    });

    // The persisted copies actually have their coordinates candidate stripped — the entire point
    // of persistCoordinateFreeCopy — so a future healing pass can never silently fall back to a
    // coordinate tap for these three elements.
    const addedOptionCopies = mocks.elementRepository.add.mock.calls
      .map(([added]) => added)
      .filter((added) => ['Passport', 'Salary', 'English'].includes(added.accessibilityId));
    expect(addedOptionCopies).toHaveLength(3);
    for (const copy of addedOptionCopies) {
      expect(
        copy.locators.some((locator) => locator.strategy === LocatorStrategy.COORDINATES),
      ).toBe(false);
      expect(
        copy.locators.some((locator) => locator.strategy === LocatorStrategy.ACCESSIBILITY_ID),
      ).toBe(true);
    }

    // Agree to all checkbox: verify/click/wait, the final 3 KYC steps.
    const agreeVerifyIndex = kycSteps.findIndex((step) => step.elementId === 'kyc-agree-checkbox');
    expect(agreeVerifyIndex).toBe(27);
    expect(kycSteps[agreeVerifyIndex].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(kycSteps[agreeVerifyIndex + 1].action).toBe(ActionType.CLICK);
    expect(kycSteps[agreeVerifyIndex + 1].elementId).toBe('kyc-agree-checkbox');
    expect(kycSteps[agreeVerifyIndex + 2].action).toBe(ActionType.WAIT);
    expect(kycSteps).toHaveLength(30);

    // The test case ends right at "Agree to all" — no further step (in particular, no Register
    // tap) is ever appended.
    expect(testCase.steps[testCase.steps.length - 1]).toEqual(
      expect.objectContaining({
        action: ActionType.WAIT,
        expectedResult: 'The form finishes updating after checking Agree to all.',
      }),
    );
  });

  it('returns an empty array (not an error) when no sign-up trigger is found', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(
      createElement({ elementId: 'element-9', text: 'Promotions' }),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.elementRepository.search).not.toHaveBeenCalled();
  });

  it('returns an empty array (not an error) when the sign-up form is missing a required field', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockImplementation(async (elementId) => {
      if (elementId === 'signup-trigger') return SIGN_UP_TRIGGER;
      return null;
    });
    const f = createFormFields();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'signup-screen') {
        // Missing the email input entirely.
        return [f.mobileInput, f.passwordInput, f.firstNameInput, f.surnameInput, f.nextButton];
      }
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Sign-up form fields (mobile/password/first name/surname/email) were not all found, skipping sign-up test case generation.',
      expect.objectContaining({ screenId: 'signup-screen' }),
    );
  });

  it('returns an empty array (not an error) when no "Next" button is confidently identified', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockImplementation(async (elementId) => {
      if (elementId === 'signup-trigger') return SIGN_UP_TRIGGER;
      return null;
    });
    const f = createFormFields();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'signup-screen') {
        return [f.mobileInput, f.passwordInput, f.firstNameInput, f.surnameInput, f.emailInput];
      }
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'No "Next" button was confidently identified on the sign-up form, skipping sign-up test case generation.',
      expect.objectContaining({ screenId: 'signup-screen' }),
    );
  });

  it('finds the sign-up trigger via the nested login-form fallback shape too (no login edge required)', async () => {
    const mocks = createMocks();
    const nestedSignUpTrigger = createElement({
      elementId: 'nested-signup-trigger',
      screenId: 'login-screen',
      className: 'android.widget.TextView',
      text: 'Sign Up',
      resourceId: 'com.example.app:id/loginSignUp',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/loginSignUp',
          priority: 1,
        },
      ],
    });
    mocks.elementRepository.findById.mockImplementation(async (elementId) => {
      if (elementId === 'nested-signup-trigger') return nestedSignUpTrigger;
      return null;
    });
    const f = createFormFields();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'signup-screen') {
        return [
          f.mobileInput,
          f.passwordInput,
          f.firstNameInput,
          f.surnameInput,
          f.emailInput,
          f.nextButton,
        ];
      }
      return [];
    });
    const generator = createGenerator(mocks);
    const graph = createGraph({
      edges: [
        { fromScreenId: 'home-screen', toScreenId: 'login-screen', elementId: 'login-trigger' },
        {
          fromScreenId: 'login-screen',
          toScreenId: 'signup-screen',
          elementId: 'nested-signup-trigger',
        },
      ],
    });

    const result = await generator.generate({ navigationGraph: graph, ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].steps[0].elementId).toBe('nested-signup-trigger');
  });

  it('returns a TestCaseGenerationError when the element repository fails', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockRejectedValue(new Error('disk read error'));
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/disk read error/);
  });
});
