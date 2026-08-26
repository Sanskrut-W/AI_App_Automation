import { Element } from '../../../core/entities/Element';
import { LocatorCandidate } from '../../../core/value-objects/LocatorCandidate';
import { IAiLocatorHealingFallback } from '../../../application/interfaces/ai/IAiLocatorHealingFallback';
import { IGeminiClient } from '../../../application/interfaces/ai/IGeminiClient';
import { ILocatorHealingPromptBuilder } from '../../../application/use-cases/locator-healing/ILocatorHealingPromptBuilder';
import { isLocatorHealingSuggestion } from '../../../application/use-cases/locator-healing/isLocatorHealingSuggestion';
import { ILogger } from '../../../shared/logger/ILogger';

/** Concrete IAiLocatorHealingFallback backed by Gemini — only ever consulted by LocatorHealingEngine after deterministic fingerprint matching finds nothing confident enough. */
export class GeminiLocatorHealingFallback implements IAiLocatorHealingFallback {
  constructor(
    private readonly geminiClient: IGeminiClient,
    private readonly promptBuilder: ILocatorHealingPromptBuilder,
    private readonly logger: ILogger,
  ) {}

  async heal(element: Element, candidates: Element[]): Promise<LocatorCandidate[] | null> {
    if (candidates.length === 0) {
      return null;
    }

    this.logger.info('Asking Gemini to suggest a locator healing match', {
      elementId: element.elementId,
      candidateCount: candidates.length,
    });

    const prompt = this.promptBuilder.build(element, candidates);
    const result = await this.geminiClient.generateJson<unknown>({ prompt });

    if (result.isErr()) {
      this.logger.warn('AI-assisted locator healing request failed', {
        elementId: element.elementId,
        reason: result.unwrapErr().message,
      });
      return null;
    }

    const suggestion = result.unwrap();
    if (!isLocatorHealingSuggestion(suggestion)) {
      this.logger.warn('AI-assisted locator healing returned an unexpected response shape', {
        elementId: element.elementId,
      });
      return null;
    }

    if (
      suggestion.matchIndex === null ||
      suggestion.matchIndex < 0 ||
      suggestion.matchIndex >= candidates.length
    ) {
      this.logger.info('AI-assisted locator healing found no confident match', {
        elementId: element.elementId,
      });
      return null;
    }

    const matched = candidates[suggestion.matchIndex];
    this.logger.info('AI-assisted locator healing found a match', {
      elementId: element.elementId,
      matchedElementId: matched.elementId,
    });
    return matched.locators;
  }
}
