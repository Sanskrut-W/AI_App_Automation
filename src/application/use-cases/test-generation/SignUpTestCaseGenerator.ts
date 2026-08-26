import { TestCase } from '../../../core/entities/TestCase';
import { Element } from '../../../core/entities/Element';
import { TestPriority } from '../../../core/enums/TestPriority';
import { LocatorStrategy } from '../../../core/enums/LocatorStrategy';
import { TestStep } from '../../../core/value-objects/TestStep';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IIdGenerator } from '../../../shared/id/IIdGenerator';
import { isSignUpTriggerElement } from '../../../shared/text/isSignUpTriggerElement';
import {
  generateRandomSignUpDetails,
  RandomSignUpDetails,
} from '../../../shared/random/generateRandomSignUpDetails';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { NavigationGraph, NavigationGraphEdge } from '../../dto/NavigationGraph';
import { SignUpTestCaseRequest } from '../../dto/SignUpTestCaseRequest';
import { ISignUpTestCaseGenerator } from './ISignUpTestCaseGenerator';
import {
  verifyStep,
  clickStep,
  typeStep,
  waitStep,
  toLocator,
  toLocatorForStrategy,
} from './TestStepBuilder';

const TEXT_INPUT_CLASS_PATTERN = /edittext|autocompletetextview/i;
const NEXT_BUTTON_LABEL_PATTERN = /^next$/i;
const SPINNER_CLASS = 'android.widget.Spinner';
/** Two fields whose vertical centers land within this many px of each other are treated as the
 * SAME logical field, not two different ones — observed directly on the real Betway ZA sign-up
 * form, where the "Mobile Number" row's WebView markup produces two overlapping EditText nodes at
 * nearly the same position (one with a resourceId, one without), 27px apart, while genuinely
 * distinct rows on the same form are ~130px+ apart. */
const OVERLAPPING_FIELD_THRESHOLD_PX = 60;
/** The sign-up form is WebView-hosted and was observed taking noticeably longer to finish
 * navigating to than the (native) login form — see ScreenCrawler's own settle-wait for the same
 * observation during crawling. */
const SIGN_UP_FORM_SETTLE_MS = 3000;
const SIGN_UP_NEXT_SETTLE_MS = 1500;
/** Verified live: the KYC screen's dropdowns/date-picker/dependent fields each take a moment to
 * finish opening, closing, or appearing after the tap that triggers them. */
const KYC_STEP_SETTLE_MS = 800;
const AGREE_TO_ALL_LABEL = 'Agree to all';
const PASSPORT_OPTION_LABEL = 'Passport';
const SALARY_OPTION_LABEL = 'Salary';
const ENGLISH_OPTION_LABEL = 'English';
/** Minimum count of small, grid-arranged native Views that marks a captured screen as the native
 * DatePicker's day-grid, as opposed to any other screen — see findDobDayCell. */
const MIN_DAY_CELL_CANDIDATES = 20;
/** Index into the sorted day-cell candidates: a row comfortably inside the currently-shown month,
 * clear of both the leading blank cells and any dates Android's DatePicker greys out under its
 * automatic 18+ age-gate enforcement near the end of the month — verified live (see the sign-up
 * KYC discovery notes: any enabled/selectable day satisfies the 18+ constraint). */
const DOB_DAY_CELL_INDEX = 14;

interface SignUpFormFields {
  mobileInput: Element;
  passwordInput: Element;
  firstNameInput: Element;
  surnameInput: Element;
  emailInput: Element;
}

/** The registration-details ("KYC") screen's controls, reached by filling the first sign-up page
 * and tapping Next. See findKycExtension for how these are located. */
interface KycExtension {
  idTypeSpinner: Element;
  passportOption: Element;
  passportInput: Element;
  dobInput: Element;
  dobDayCell: Element;
  sourceOfFundsSpinner: Element;
  salaryOption: Element;
  languageSpinner: Element;
  englishOption: Element;
  agreeCheckbox: Element;
}

/**
 * Deterministic, navigation-graph-driven generator for a single sign-up test case.
 *
 * Finds the DIRECT "Sign Up" trigger on the app's home screen (see ScreenCrawler: peekSignUpForm
 * is now called directly from exploreScreen when found there, rather than only nested inside the
 * login form — the real registration entry point end users tap), locates its mobile/password/
 * first-name/surname/email inputs and its "Next" button, and builds a test case that opens the
 * form, fills in freshly generated random details, and clicks Next.
 *
 * If the registration-details ("KYC") screen reached after Next has ALSO been discovered —
 * necessarily via a live discovery/execution run rather than a crawl, since the crawler's
 * capture-only peek policy can never fill in and submit the first page to reach it — the test case
 * is extended to also: select ID Type "Passport" (typing a passport number into the field that
 * appears), pick a Date of Birth, select Source of Funds "Salary", Communication Language
 * "English", and check "Agree to all". It deliberately never taps Register.
 */
export class SignUpTestCaseGenerator implements ISignUpTestCaseGenerator {
  constructor(
    private readonly elementRepository: IElementRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger,
  ) {}

  async generate(
    request: SignUpTestCaseRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>> {
    try {
      const found = await this.findSignUpEdge(request.navigationGraph);
      if (!found) {
        this.logger.warn(
          'No sign-up trigger was found in this crawl, skipping sign-up test case generation.',
        );
        return Result.ok([]);
      }
      const { edge: signUpEdge, element: signUpTriggerElement } = found;

      const formElements = await this.elementRepository.search({ screenId: signUpEdge.toScreenId });
      const fields = this.findFormFields(formElements);
      if (!fields) {
        this.logger.warn(
          'Sign-up form fields (mobile/password/first name/surname/email) were not all found, skipping sign-up test case generation.',
          { screenId: signUpEdge.toScreenId },
        );
        return Result.ok([]);
      }

      const nextButton = this.findNextButton(formElements);
      if (!nextButton) {
        this.logger.warn(
          'No "Next" button was confidently identified on the sign-up form, skipping sign-up test case generation.',
          { screenId: signUpEdge.toScreenId },
        );
        return Result.ok([]);
      }

      const kycExtension = await this.findKycExtension();
      if (!kycExtension) {
        this.logger.warn(
          'Registration-details (KYC) screen data was not found; generating the sign-up test case up to "Next" only.',
        );
      }

      const details = generateRandomSignUpDetails();
      const testCase = this.buildTestCase(
        request,
        signUpTriggerElement,
        fields,
        nextButton,
        details,
        kycExtension,
      );

      this.logger.info('Sign-up test case generation complete', {
        signUpScreenId: signUpEdge.toScreenId,
        includesKycSteps: kycExtension !== null,
      });
      return Result.ok([testCase]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new TestCaseGenerationError(`Failed to generate sign-up test case: ${message}`),
      );
    }
  }

  /** Finds the (at most one, per ScreenCrawler's shared signUpPeek guard) edge whose element is a
   * recognized sign-up trigger — reached either directly from the home screen, or as a fallback,
   * nested inside the login form. Either shape works identically here: this no longer requires a
   * preceding login edge, since the direct home-screen button doesn't go through Login at all. */
  private async findSignUpEdge(
    graph: NavigationGraph,
  ): Promise<{ edge: NavigationGraphEdge; element: Element } | null> {
    for (const edge of graph.edges) {
      const element = await this.elementRepository.findById(edge.elementId);
      if (element && isSignUpTriggerElement(element)) {
        return { edge, element };
      }
    }
    return null;
  }

  private isTextInput(element: Element): boolean {
    return TEXT_INPUT_CLASS_PATTERN.test(element.className) && element.locators.length > 0;
  }

  private findFormFields(elements: Element[]): SignUpFormFields | null {
    const textInputs = elements
      .filter((element) => this.isTextInput(element))
      .sort((a, b) => a.bounds.top - b.bounds.top);
    const deduped = this.dedupeOverlappingFields(textInputs);

    const passwordInput = deduped.find((element) => element.isPassword);
    const [mobileInput, firstNameInput, surnameInput, emailInput] = deduped.filter(
      (element) => !element.isPassword,
    );

    if (!passwordInput || !mobileInput || !firstNameInput || !surnameInput || !emailInput) {
      return null;
    }
    return { mobileInput, passwordInput, firstNameInput, surnameInput, emailInput };
  }

  /** See OVERLAPPING_FIELD_THRESHOLD_PX. Between two overlapping candidates, prefers the one with
   * an actual resourceId locator (more reliable to re-locate later) over one relying only on
   * xpath/coordinates. */
  private dedupeOverlappingFields(sortedByTop: Element[]): Element[] {
    const deduped: Element[] = [];
    for (const element of sortedByTop) {
      const previous = deduped[deduped.length - 1];
      if (
        previous &&
        this.verticalCenterDistance(previous, element) < OVERLAPPING_FIELD_THRESHOLD_PX
      ) {
        if (!previous.resourceId && element.resourceId) {
          deduped[deduped.length - 1] = element;
        }
        continue;
      }
      deduped.push(element);
    }
    return deduped;
  }

  private verticalCenterDistance(a: Element, b: Element): number {
    const centerA = (a.bounds.top + a.bounds.bottom) / 2;
    const centerB = (b.bounds.top + b.bounds.bottom) / 2;
    return Math.abs(centerA - centerB);
  }

  private findNextButton(elements: Element[]): Element | null {
    return (
      elements.find(
        (element) =>
          element.clickable &&
          element.locators.length > 0 &&
          NEXT_BUTTON_LABEL_PATTERN.test(
            (element.text || element.contentDescription || element.accessibilityId).trim(),
          ),
      ) ?? null
    );
  }

  /**
   * Locates the registration-details (KYC) screen's controls by CONTENT, scanning every persisted
   * element grouped by the screen it belongs to — not by walking navigation-graph edges, since the
   * crawler's peek can never fill in and submit the first sign-up page to reach this screen (see
   * class doc comment). This data only exists once some prior live discovery or execution run has
   * captured it into the same element repository; if it hasn't, this gracefully returns null and
   * generate() falls back to a test case that stops at "Next".
   */
  private async findKycExtension(): Promise<KycExtension | null> {
    let allElements: Element[] = [];
    try {
      allElements = (await this.elementRepository.findAll()) ?? [];
    } catch (error) {
      this.logger.warn('Failed to search for registration-details (KYC) screen data', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    const groups = this.groupByScreen(allElements);

    const kycGroup = this.firstMatchingGroup(groups, (elements) => {
      const spinnerCount = elements.filter((e) => e.className === SPINNER_CLASS).length;
      const kycEditTextCount = elements.filter(
        (e) => this.isTextInput(e) && e.bounds.top > 600,
      ).length;
      return (
        spinnerCount >= 3 &&
        kycEditTextCount >= 2 &&
        elements.some((e) => this.isAgreeToAllCheckbox(e))
      );
    });
    if (!kycGroup) {
      return null;
    }

    const spinners = kycGroup
      .filter((e) => e.className === SPINNER_CLASS)
      .sort((a, b) => a.bounds.top - b.bounds.top);
    const [idTypeSpinner, sourceOfFundsSpinner, languageSpinner] = spinners;

    const kycEditTexts = kycGroup
      .filter((e) => this.isTextInput(e) && e.bounds.top > 600)
      .sort((a, b) => a.bounds.top - b.bounds.top);
    const [passportInput, dobInput] = kycEditTexts;

    const agreeCheckbox = kycGroup.find((e) => this.isAgreeToAllCheckbox(e)) ?? null;
    const passportOption = this.findOptionElement(groups, PASSPORT_OPTION_LABEL);
    const salaryOption = this.findOptionElement(groups, SALARY_OPTION_LABEL);
    const englishOption = this.findOptionElement(groups, ENGLISH_OPTION_LABEL);
    const dobDayCell = this.findDobDayCell(groups);

    if (
      !idTypeSpinner ||
      !sourceOfFundsSpinner ||
      !languageSpinner ||
      !passportInput ||
      !dobInput ||
      !agreeCheckbox ||
      !passportOption ||
      !salaryOption ||
      !englishOption ||
      !dobDayCell
    ) {
      this.logger.warn(
        'A registration-details (KYC) screen was found but some of its controls were not; skipping KYC steps.',
      );
      return null;
    }

    return {
      idTypeSpinner,
      passportOption: await this.persistCoordinateFreeCopy(passportOption),
      passportInput,
      dobInput,
      dobDayCell,
      sourceOfFundsSpinner,
      salaryOption: await this.persistCoordinateFreeCopy(salaryOption),
      languageSpinner,
      englishOption: await this.persistCoordinateFreeCopy(englishOption),
      agreeCheckbox,
    };
  }

  private groupByScreen(elements: Element[]): Map<string, Element[]> {
    const groups = new Map<string, Element[]>();
    for (const element of elements) {
      const group = groups.get(element.screenId);
      if (group) {
        group.push(element);
      } else {
        groups.set(element.screenId, [element]);
      }
    }
    return groups;
  }

  private firstMatchingGroup(
    groups: Map<string, Element[]>,
    predicate: (elements: Element[]) => boolean,
  ): Element[] | null {
    for (const group of groups.values()) {
      if (predicate(group)) {
        return group;
      }
    }
    return null;
  }

  /**
   * Dropdown option items (Passport/Salary/English) were verified live to NOT reliably respond to
   * a raw coordinate gesture — only a genuine element-based click (via accessibility-id or
   * similar) triggers their real click handler (see toAccessibilityIdLocator). The shared
   * LocatorHealingEngine, though, has a cheap "self-heal via coordinates" path that fires
   * automatically whenever the referenced element has a coordinates candidate alongside an
   * alternate one — bypassing real re-identification entirely. Left unaddressed, a transient
   * accessibility-id lookup failure at execution time would silently "heal" into a coordinate tap
   * that reports success but never actually selects anything (observed live: Source of Funds and
   * Language stayed unset despite their steps reporting "passed"). Persisting a coordinate-free
   * copy and referencing THAT in the generated step closes this off: if accessibility-id ever
   * needs healing, the engine is forced into genuine fingerprint-based re-identification instead.
   */
  private async persistCoordinateFreeCopy(element: Element): Promise<Element> {
    const copy = new Element({
      elementId: this.idGenerator.generate(),
      screenId: element.screenId,
      className: element.className,
      text: element.text,
      resourceId: element.resourceId,
      accessibilityId: element.accessibilityId,
      contentDescription: element.contentDescription,
      bounds: element.bounds,
      clickable: element.clickable,
      enabled: element.enabled,
      selected: element.selected,
      checked: element.checked,
      isPassword: element.isPassword,
      parentElementId: element.parentElementId,
      childElementIds: element.childElementIds,
      locators: element.locators.filter(
        (locator) => locator.strategy !== LocatorStrategy.COORDINATES,
      ),
    });
    await this.elementRepository.add(copy);
    return copy;
  }

  private isAgreeToAllCheckbox(element: Element): boolean {
    return (
      element.className.includes('CheckBox') &&
      (element.text === AGREE_TO_ALL_LABEL ||
        element.accessibilityId === AGREE_TO_ALL_LABEL ||
        element.contentDescription === AGREE_TO_ALL_LABEL)
    );
  }

  /** Dropdown option items (Passport/Salary/English) are custom popup-list rows whose XML
   * `clickable` attribute was verified live to be misleadingly false — matched purely by their
   * content-desc label, regardless of that flag. */
  private findOptionElement(groups: Map<string, Element[]>, label: string): Element | null {
    for (const group of groups.values()) {
      const match = group.find(
        (e) =>
          e.locators.length > 0 && (e.accessibilityId === label || e.contentDescription === label),
      );
      if (match) {
        return match;
      }
    }
    return null;
  }

  /** The native DatePicker's day-grid cells are plain, unlabeled Views — identified structurally
   * (small, square, low on the dialog) rather than by any text/id, since none exists. */
  private findDobDayCell(groups: Map<string, Element[]>): Element | null {
    for (const group of groups.values()) {
      const dayCells = group
        .filter(
          (e) =>
            e.className === 'android.view.View' &&
            e.bounds.top > 1000 &&
            e.bounds.right - e.bounds.left < 150,
        )
        .sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
      if (dayCells.length >= MIN_DAY_CELL_CANDIDATES) {
        return dayCells[Math.min(DOB_DAY_CELL_INDEX, dayCells.length - 1)];
      }
    }
    return null;
  }

  private buildTestCase(
    request: SignUpTestCaseRequest,
    signUpTriggerElement: Element,
    fields: SignUpFormFields,
    nextButton: Element,
    details: RandomSignUpDetails,
    kycExtension: KycExtension | null,
  ): TestCase {
    const signUpTriggerLocator = toLocator(signUpTriggerElement);
    const nextButtonLocator = toLocator(nextButton);

    const steps: TestStep[] = [
      verifyStep(
        1,
        signUpTriggerLocator,
        signUpTriggerElement,
        'The Sign Up button is present on the home screen.',
      ),
      clickStep(
        2,
        signUpTriggerLocator,
        signUpTriggerElement,
        'Tapping Sign Up opens the sign-up form.',
      ),
      waitStep(3, SIGN_UP_FORM_SETTLE_MS, 'The sign-up form finishes opening.'),
    ];

    const fillTargets: Array<{ element: Element; value: string; description: string }> = [
      { element: fields.mobileInput, value: details.mobileNumber, description: 'mobile number' },
      { element: fields.passwordInput, value: details.password, description: 'password' },
      { element: fields.firstNameInput, value: details.firstName, description: 'first name' },
      { element: fields.surnameInput, value: details.surname, description: 'surname' },
      { element: fields.emailInput, value: details.email, description: 'email' },
    ];

    let stepNumber = 4;
    for (const target of fillTargets) {
      const locator = toLocator(target.element);
      steps.push(
        verifyStep(
          stepNumber++,
          locator,
          target.element,
          `The ${target.description} input is present.`,
        ),
        clickStep(
          stepNumber++,
          locator,
          target.element,
          `The ${target.description} input gains focus.`,
        ),
        typeStep(
          stepNumber++,
          locator,
          target.element,
          target.value,
          `The ${target.description} is entered.`,
        ),
      );
    }

    steps.push(
      verifyStep(stepNumber++, nextButtonLocator, nextButton, 'The Next button is present.'),
      clickStep(
        stepNumber++,
        nextButtonLocator,
        nextButton,
        'Tapping Next advances the sign-up flow.',
      ),
      waitStep(
        stepNumber++,
        SIGN_UP_NEXT_SETTLE_MS,
        "The sign-up flow's next step finishes loading.",
      ),
    );

    if (kycExtension) {
      stepNumber = this.appendKycSteps(steps, stepNumber, kycExtension, details);
    }

    return new TestCase({
      testCaseId: this.idGenerator.generate(),
      screenId: fields.mobileInput.screenId,
      title: 'Sign up: random details',
      description: kycExtension
        ? 'Opens the sign-up form via the direct Sign Up button, fills it with freshly generated random details, advances through Next, then completes the registration-details (KYC) screen (ID Type, Passport, Date of Birth, Source of Funds, Language, Agree to all) — stopping before Register.'
        : 'Opens the sign-up form via the direct Sign Up button and fills it with freshly generated random details, then taps Next.',
      steps,
      priority: TestPriority.HIGH,
      tags: ['sign-up'],
      appVersionName: request.appVersionName,
      appVersionCode: request.appVersionCode,
    });
  }

  private appendKycSteps(
    steps: TestStep[],
    startStepNumber: number,
    kyc: KycExtension,
    details: RandomSignUpDetails,
  ): number {
    let stepNumber = startStepNumber;
    const idTypeLocator = toLocatorForStrategy(kyc.idTypeSpinner, LocatorStrategy.COORDINATES);
    const passportOptionLocator = toLocatorForStrategy(
      kyc.passportOption,
      LocatorStrategy.ACCESSIBILITY_ID,
    );
    const passportInputLocator = toLocator(kyc.passportInput);
    const dobInputLocator = toLocator(kyc.dobInput);
    const dobDayCellLocator = toLocatorForStrategy(kyc.dobDayCell, LocatorStrategy.COORDINATES);
    const sourceOfFundsLocator = toLocatorForStrategy(
      kyc.sourceOfFundsSpinner,
      LocatorStrategy.COORDINATES,
    );
    const salaryOptionLocator = toLocatorForStrategy(
      kyc.salaryOption,
      LocatorStrategy.ACCESSIBILITY_ID,
    );
    const languageLocator = toLocatorForStrategy(kyc.languageSpinner, LocatorStrategy.COORDINATES);
    const englishOptionLocator = toLocatorForStrategy(
      kyc.englishOption,
      LocatorStrategy.ACCESSIBILITY_ID,
    );
    const agreeCheckboxLocator = toLocator(kyc.agreeCheckbox);

    steps.push(
      verifyStep(
        stepNumber++,
        idTypeLocator,
        kyc.idTypeSpinner,
        'The ID Type dropdown is present.',
      ),
      clickStep(
        stepNumber++,
        idTypeLocator,
        kyc.idTypeSpinner,
        'Tapping ID Type opens its options.',
      ),
      waitStep(stepNumber++, KYC_STEP_SETTLE_MS, 'The ID Type options finish opening.'),

      verifyStep(
        stepNumber++,
        passportOptionLocator,
        kyc.passportOption,
        'The Passport option is present.',
      ),
      clickStep(
        stepNumber++,
        passportOptionLocator,
        kyc.passportOption,
        'Selecting Passport reveals the passport number field.',
      ),
      waitStep(stepNumber++, KYC_STEP_SETTLE_MS, 'The passport number field finishes appearing.'),

      verifyStep(
        stepNumber++,
        passportInputLocator,
        kyc.passportInput,
        'The passport number input is present.',
      ),
      clickStep(
        stepNumber++,
        passportInputLocator,
        kyc.passportInput,
        'The passport number input gains focus.',
      ),
      typeStep(
        stepNumber++,
        passportInputLocator,
        kyc.passportInput,
        details.passportNumber,
        'The passport number is entered.',
      ),

      verifyStep(
        stepNumber++,
        dobInputLocator,
        kyc.dobInput,
        'The Date of Birth input is present.',
      ),
      clickStep(
        stepNumber++,
        dobInputLocator,
        kyc.dobInput,
        'Tapping Date of Birth opens the date picker.',
      ),
      waitStep(stepNumber++, KYC_STEP_SETTLE_MS, 'The date picker finishes opening.'),

      verifyStep(
        stepNumber++,
        dobDayCellLocator,
        kyc.dobDayCell,
        'A selectable (18+) date is present in the date picker.',
      ),
      clickStep(
        stepNumber++,
        dobDayCellLocator,
        kyc.dobDayCell,
        'Selecting a date fills in the Date of Birth.',
      ),
      waitStep(stepNumber++, KYC_STEP_SETTLE_MS, 'The date picker finishes closing.'),

      verifyStep(
        stepNumber++,
        sourceOfFundsLocator,
        kyc.sourceOfFundsSpinner,
        'The Source of Funds dropdown is present.',
      ),
      clickStep(
        stepNumber++,
        sourceOfFundsLocator,
        kyc.sourceOfFundsSpinner,
        'Tapping Source of Funds opens its options.',
      ),
      waitStep(stepNumber++, KYC_STEP_SETTLE_MS, 'The Source of Funds options finish opening.'),

      verifyStep(
        stepNumber++,
        salaryOptionLocator,
        kyc.salaryOption,
        'The Salary option is present.',
      ),
      clickStep(
        stepNumber++,
        salaryOptionLocator,
        kyc.salaryOption,
        'Selecting Salary sets the Source of Funds.',
      ),
      waitStep(stepNumber++, KYC_STEP_SETTLE_MS, 'The Source of Funds options finish closing.'),

      verifyStep(
        stepNumber++,
        languageLocator,
        kyc.languageSpinner,
        'The Communication Language dropdown is present.',
      ),
      clickStep(
        stepNumber++,
        languageLocator,
        kyc.languageSpinner,
        'Tapping Communication Language opens its options.',
      ),
      waitStep(
        stepNumber++,
        KYC_STEP_SETTLE_MS,
        'The Communication Language options finish opening.',
      ),

      verifyStep(
        stepNumber++,
        englishOptionLocator,
        kyc.englishOption,
        'The English option is present.',
      ),
      clickStep(
        stepNumber++,
        englishOptionLocator,
        kyc.englishOption,
        'Selecting English sets the Communication Language.',
      ),
      waitStep(
        stepNumber++,
        KYC_STEP_SETTLE_MS,
        'The Communication Language options finish closing.',
      ),

      verifyStep(
        stepNumber++,
        agreeCheckboxLocator,
        kyc.agreeCheckbox,
        'The Agree to all checkbox is present.',
      ),
      clickStep(
        stepNumber++,
        agreeCheckboxLocator,
        kyc.agreeCheckbox,
        'Checking Agree to all accepts all required consents. Register is never tapped.',
      ),
      waitStep(
        stepNumber++,
        KYC_STEP_SETTLE_MS,
        'The form finishes updating after checking Agree to all.',
      ),
    );

    return stepNumber;
  }
}
