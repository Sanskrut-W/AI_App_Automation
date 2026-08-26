import { TestCase } from '../../../core/entities/TestCase';
import { Element } from '../../../core/entities/Element';
import { ActionType } from '../../../core/enums/ActionType';
import { TestPriority } from '../../../core/enums/TestPriority';
import { TestStep } from '../../../core/value-objects/TestStep';
import { ElementLocator } from '../../../core/value-objects/ElementLocator';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IIdGenerator } from '../../../shared/id/IIdGenerator';
import { textSimilarity } from '../../../shared/text/textSimilarity';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { TestCaseGenerationRequest } from '../../dto/TestCaseGenerationRequest';
import { ITestCaseGenerator } from './ITestCaseGenerator';

export interface TestCaseGeneratorOptions {
  /** Minimum match score (0-1) for an "important element" description to be linked to a real element. */
  matchThreshold?: number;
  /** Sample value used for generated Type steps. */
  defaultTestInputValue?: string;
}

const DEFAULT_MATCH_THRESHOLD = 0.35;
const DEFAULT_TEST_INPUT_VALUE = 'Test123';
const TEXT_INPUT_CLASS_PATTERN = /edittext|autocompletetextview/i;

/**
 * Deterministically bridges Module 11's AI analysis (plain-language element descriptions) to
 * concrete, executable test cases: matches each "important element" description against real
 * parsed elements via fuzzy text matching (no AI — same "deterministic first" philosophy as the
 * fingerprinting and future locator-healing modules), then generates steps from simple,
 * element-type-driven rules.
 */
export class TestCaseGenerator implements ITestCaseGenerator {
  private readonly matchThreshold: number;
  private readonly defaultTestInputValue: string;

  constructor(
    private readonly elementRepository: IElementRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger,
    options: TestCaseGeneratorOptions = {},
  ) {
    this.matchThreshold = options.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
    this.defaultTestInputValue = options.defaultTestInputValue ?? DEFAULT_TEST_INPUT_VALUE;
  }

  async generate(
    request: TestCaseGenerationRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>> {
    this.logger.info('Generating test cases', { screenId: request.screenId });

    try {
      const elements = await this.elementRepository.search({ screenId: request.screenId });
      const matchableElements = elements.filter((element) => element.locators.length > 0);

      const testCases: TestCase[] = [];
      for (const description of request.screenAnalysis.importantElements) {
        const match = this.findBestMatch(description, matchableElements);
        if (!match) {
          this.logger.debug('No matching element found for important element description', {
            screenId: request.screenId,
            description,
          });
          continue;
        }

        testCases.push(this.buildTestCase(request, description, match));
      }

      this.logger.info('Test case generation complete', {
        screenId: request.screenId,
        count: testCases.length,
      });
      return Result.ok(testCases);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Test case generation failed', error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(new TestCaseGenerationError(`Failed to generate test cases: ${message}`));
    }
  }

  private findBestMatch(description: string, elements: Element[]): Element | null {
    let best: { element: Element; score: number } | null = null;

    for (const element of elements) {
      const score = this.scoreElement(description, element);
      if (score >= this.matchThreshold && (!best || score > best.score)) {
        best = { element, score };
      }
    }

    return best?.element ?? null;
  }

  private scoreElement(description: string, element: Element): number {
    const candidates = [
      element.text,
      element.contentDescription,
      this.simplifyResourceId(element.resourceId),
    ].filter((candidate) => candidate.length > 0);

    if (candidates.length === 0) {
      return 0;
    }
    return Math.max(...candidates.map((candidate) => this.matchScore(description, candidate)));
  }

  private matchScore(description: string, candidate: string): number {
    const normalizedDescription = description.toLowerCase().trim();
    const normalizedCandidate = candidate.toLowerCase().trim();
    if (!normalizedCandidate) {
      return 0;
    }
    if (
      normalizedDescription.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedDescription)
    ) {
      return 1;
    }
    return textSimilarity(normalizedDescription, normalizedCandidate);
  }

  private simplifyResourceId(resourceId: string): string {
    const idx = resourceId.lastIndexOf('/');
    return idx >= 0 ? resourceId.slice(idx + 1) : resourceId;
  }

  private buildTestCase(
    request: TestCaseGenerationRequest,
    description: string,
    element: Element,
  ): TestCase {
    const locator = this.toLocator(element);
    const steps: TestStep[] = [
      {
        stepNumber: 1,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: locator,
        elementId: element.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: `${description} is present on the screen.`,
      },
    ];

    if (this.isTextInput(element)) {
      steps.push({
        stepNumber: steps.length + 1,
        action: ActionType.TYPE,
        targetLocator: locator,
        elementId: element.elementId,
        value: this.defaultTestInputValue,
        direction: null,
        durationMs: null,
        expectedResult: `Text is entered into ${description}.`,
      });
    } else if (element.clickable) {
      steps.push({
        stepNumber: steps.length + 1,
        action: ActionType.CLICK,
        targetLocator: locator,
        elementId: element.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: `${description} responds to a tap.`,
      });
    }

    return new TestCase({
      testCaseId: this.idGenerator.generate(),
      screenId: request.screenId,
      title: `${request.screenAnalysis.screenName}: ${description}`,
      description: request.screenAnalysis.screenPurpose,
      steps,
      priority: TestPriority.MEDIUM,
      tags: [...request.screenAnalysis.suggestedTestAreas],
      appVersionName: request.appVersionName,
      appVersionCode: request.appVersionCode,
    });
  }

  private toLocator(element: Element): ElementLocator {
    const [best] = element.locators;
    return { strategy: best.strategy, value: best.value };
  }

  private isTextInput(element: Element): boolean {
    return TEXT_INPUT_CLASS_PATTERN.test(element.className);
  }
}
