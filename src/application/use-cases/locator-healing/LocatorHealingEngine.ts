import { Element } from '../../../core/entities/Element';
import { ElementFingerprint } from '../../../core/value-objects/ElementFingerprint';
import { LocatorCandidate } from '../../../core/value-objects/LocatorCandidate';
import { LocatorStrategy } from '../../../core/enums/LocatorStrategy';
import { LocatorHealingError } from '../../../core/errors/LocatorHealingError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { IXmlElementParser } from '../../interfaces/xml/IXmlElementParser';
import { IAiLocatorHealingFallback } from '../../interfaces/ai/IAiLocatorHealingFallback';
import { LocatorHealingRequest } from '../../dto/LocatorHealingRequest';
import { LocatorHealingResult } from '../../dto/LocatorHealingResult';
import { IFingerprintEngine } from '../fingerprint/IFingerprintEngine';
import { ILocatorHealingEngine } from './ILocatorHealingEngine';
import { isSensitiveFinancialElement } from '../../../shared/text/isSensitiveFinancialElement';

export interface LocatorHealingEngineOptions {
  /** Minimum fingerprint similarity (0-1) required to trust a deterministic match. */
  confidenceThreshold?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
/** See selfHealViaCoordinates: standard Android widgets known to respond reliably to a raw
 * coordinate gesture. Deliberately excludes generic `android.view.View`/custom widget classes. */
const COORDINATE_SAFE_CLASS_PATTERN = /EditText|CheckBox|Button|TextView|Spinner/i;

/**
 * When a stored element's locators no longer resolve, re-parses the current screen's XML and
 * compares the stored element's fingerprint against every freshly-parsed candidate using Module
 * 9's deterministic FingerprintEngine. Above the confidence threshold, updates the element
 * repository with the best match's locators so future runs (and immediate retries) use the
 * healed locator. AI is never consulted unless an IAiLocatorHealingFallback is injected and
 * deterministic matching finds nothing confident enough.
 */
export class LocatorHealingEngine implements ILocatorHealingEngine {
  private readonly confidenceThreshold: number;

  constructor(
    private readonly elementRepository: IElementRepository,
    private readonly xmlParser: IXmlElementParser,
    private readonly fingerprintEngine: IFingerprintEngine,
    private readonly logger: ILogger,
    private readonly aiFallback?: IAiLocatorHealingFallback,
    options: LocatorHealingEngineOptions = {},
  ) {
    this.confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  }

  async heal(
    request: LocatorHealingRequest,
  ): Promise<Result<LocatorHealingResult, LocatorHealingError>> {
    this.logger.info('Attempting locator healing', { elementId: request.elementId });

    try {
      const element = await this.elementRepository.findById(request.elementId);
      if (!element) {
        throw new Error(`Element "${request.elementId}" not found in the repository.`);
      }

      const candidates = this.xmlParser.parse(request.currentXml, element.screenId);
      const sensitiveElement = candidates.find(isSensitiveFinancialElement);
      if (sensitiveElement) {
        // Proven live against Betway ZA: an unrelated tap silently navigated onto a Deposit Funds
        // screen, and a coordinate-healing fallback then typed a cached password into its Voucher
        // Pin field. Refuse every healing strategy (coordinate self-heal, deterministic
        // fingerprint match, AI fallback) the instant a real-money screen is detected — the safe
        // response is always to fail the step, never to guess at an interaction here.
        this.logger.warn(
          'Refusing to heal: the current screen looks like a real-money flow (deposit/withdraw/voucher/payment)',
          { elementId: request.elementId, matchedElementId: sensitiveElement.elementId },
        );
        return Result.ok({
          elementId: request.elementId,
          healed: false,
          confidence: 0,
          matchedElementId: null,
          updatedLocators: null,
          aiAssisted: false,
        });
      }

      const selfHealLocators = this.selfHealViaCoordinates(element);
      if (selfHealLocators) {
        this.logger.info(
          "Locator healed via the element's own coordinates fallback (same element, no re-identification needed)",
          { elementId: request.elementId },
        );
        return Result.ok({
          elementId: request.elementId,
          healed: true,
          confidence: 1,
          matchedElementId: element.elementId,
          updatedLocators: selfHealLocators,
          aiAssisted: false,
        });
      }

      const knownElements = await this.elementRepository.search({ screenId: element.screenId });
      const referenceFingerprint = this.fingerprintEngine.fingerprintElement(
        element,
        knownElements,
      );

      const best = this.findBestMatch(referenceFingerprint, candidates);

      if (best && best.score >= this.confidenceThreshold) {
        await this.elementRepository.update(request.elementId, {
          locators: best.element.locators,
        });

        this.logger.info('Locator healed via deterministic fingerprint matching', {
          elementId: request.elementId,
          confidence: best.score,
          matchedElementId: best.element.elementId,
        });

        return Result.ok({
          elementId: request.elementId,
          healed: true,
          confidence: best.score,
          matchedElementId: best.element.elementId,
          updatedLocators: best.element.locators,
          aiAssisted: false,
        });
      }

      this.logger.warn('No confident deterministic locator match found', {
        elementId: request.elementId,
        bestConfidence: best?.score ?? 0,
      });

      const aiLocators = this.aiFallback ? await this.aiFallback.heal(element, candidates) : null;

      if (aiLocators && aiLocators.length > 0) {
        await this.elementRepository.update(request.elementId, { locators: aiLocators });

        this.logger.info('Locator healed via AI-assisted fallback', {
          elementId: request.elementId,
        });

        return Result.ok({
          elementId: request.elementId,
          healed: true,
          confidence: best?.score ?? 0,
          matchedElementId: null,
          updatedLocators: aiLocators,
          aiAssisted: true,
        });
      }

      return Result.ok({
        elementId: request.elementId,
        healed: false,
        confidence: best?.score ?? 0,
        matchedElementId: null,
        updatedLocators: null,
        aiAssisted: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Locator healing failed', error instanceof Error ? error : undefined);
      return Result.err(
        new LocatorHealingError(
          `Locator healing failed for element "${request.elementId}": ${message}`,
        ),
      );
    }
  }

  /**
   * If this exact element also has a captured coordinates locator (see XmlElementParser) besides
   * whichever one just failed, try that first — it's the same element, not a re-identification,
   * so it's cheaper and more certain than fingerprint/AI matching against a fresh screen parse.
   *
   * Gated to element classes verified live to respond reliably to a raw coordinate gesture —
   * standard Android widgets whose own framework-level touch handling fires regardless of how
   * they're tapped. A custom, app-drawn widget (in particular an `android.view.View`-based
   * popup/dropdown list item) is NOT safe to coordinate-heal blindly: verified live twice on the
   * exact same class of widget (a sign-up form's ID Type / Source of Funds / Language dropdown
   * options) that a coordinate gesture can visually land in the right place without ever
   * triggering the item's real click listener — the tap "succeeds" (no error) but silently
   * selects nothing. For anything outside the safe list, this returns null so healing falls
   * through to genuine fingerprint re-identification instead.
   */
  private selfHealViaCoordinates(element: Element): LocatorCandidate[] | null {
    if (!COORDINATE_SAFE_CLASS_PATTERN.test(element.className)) {
      return null;
    }

    const coordinatesLocator = element.locators.find(
      (locator) => locator.strategy === LocatorStrategy.COORDINATES,
    );
    if (!coordinatesLocator) {
      return null;
    }
    const hasAlternateStrategy = element.locators.some(
      (locator) => locator.strategy !== LocatorStrategy.COORDINATES,
    );
    return hasAlternateStrategy ? [coordinatesLocator] : null;
  }

  private findBestMatch(
    reference: ElementFingerprint,
    candidates: Element[],
  ): { element: Element; score: number } | null {
    let best: { element: Element; score: number } | null = null;

    for (const candidate of candidates) {
      const fingerprint = this.fingerprintEngine.fingerprintElement(candidate, candidates);
      const score = this.fingerprintEngine.elementSimilarity(reference, fingerprint);
      if (!best || score > best.score) {
        best = { element: candidate, score };
      }
    }

    return best;
  }
}
