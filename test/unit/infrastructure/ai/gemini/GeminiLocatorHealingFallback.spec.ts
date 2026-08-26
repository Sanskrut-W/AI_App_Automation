import { GeminiLocatorHealingFallback } from '../../../../../src/infrastructure/ai/gemini/GeminiLocatorHealingFallback';
import { IGeminiClient } from '../../../../../src/application/interfaces/ai/IGeminiClient';
import { ILocatorHealingPromptBuilder } from '../../../../../src/application/use-cases/locator-healing/ILocatorHealingPromptBuilder';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { GeminiClientError } from '../../../../../src/core/errors/GeminiClientError';
import { Result } from '../../../../../src/shared/result/Result';
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

function createMocks() {
  const geminiClient: jest.Mocked<IGeminiClient> = { generateJson: jest.fn() };
  const promptBuilder: jest.Mocked<ILocatorHealingPromptBuilder> = {
    build: jest.fn().mockReturnValue('prompt text'),
  };
  const logger = createMockLogger();
  return { geminiClient, promptBuilder, logger };
}

describe('GeminiLocatorHealingFallback', () => {
  it('returns null immediately without calling Gemini when there are no candidates', async () => {
    const mocks = createMocks();
    const fallback = new GeminiLocatorHealingFallback(
      mocks.geminiClient,
      mocks.promptBuilder,
      mocks.logger,
    );

    const result = await fallback.heal(createElement(), []);

    expect(result).toBeNull();
    expect(mocks.geminiClient.generateJson).not.toHaveBeenCalled();
  });

  it("returns the matched candidate's locators when Gemini picks a valid index", async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok({ matchIndex: 1 }));
    const fallback = new GeminiLocatorHealingFallback(
      mocks.geminiClient,
      mocks.promptBuilder,
      mocks.logger,
    );
    const candidateA = createElement({ elementId: 'candidate-a' });
    const candidateB = createElement({
      elementId: 'candidate-b',
      locators: [{ strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Calc', priority: 1 }],
    });

    const result = await fallback.heal(createElement(), [candidateA, candidateB]);

    expect(result).toEqual(candidateB.locators);
    expect(mocks.promptBuilder.build).toHaveBeenCalledWith(expect.any(Element), [
      candidateA,
      candidateB,
    ]);
  });

  it('returns null when Gemini reports no confident match', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok({ matchIndex: null }));
    const fallback = new GeminiLocatorHealingFallback(
      mocks.geminiClient,
      mocks.promptBuilder,
      mocks.logger,
    );

    const result = await fallback.heal(createElement(), [createElement()]);

    expect(result).toBeNull();
  });

  it('returns null when Gemini returns an out-of-range index', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok({ matchIndex: 5 }));
    const fallback = new GeminiLocatorHealingFallback(
      mocks.geminiClient,
      mocks.promptBuilder,
      mocks.logger,
    );

    const result = await fallback.heal(createElement(), [createElement()]);

    expect(result).toBeNull();
  });

  it('returns null when the response fails schema validation', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok({ unexpected: 'shape' }));
    const fallback = new GeminiLocatorHealingFallback(
      mocks.geminiClient,
      mocks.promptBuilder,
      mocks.logger,
    );

    const result = await fallback.heal(createElement(), [createElement()]);

    expect(result).toBeNull();
  });

  it('returns null when the Gemini request itself fails', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(
      Result.err(new GeminiClientError('rate limited')),
    );
    const fallback = new GeminiLocatorHealingFallback(
      mocks.geminiClient,
      mocks.promptBuilder,
      mocks.logger,
    );

    const result = await fallback.heal(createElement(), [createElement()]);

    expect(result).toBeNull();
  });
});
