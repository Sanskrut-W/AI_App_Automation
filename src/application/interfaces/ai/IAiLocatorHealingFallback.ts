import { Element } from '../../../core/entities/Element';
import { LocatorCandidate } from '../../../core/value-objects/LocatorCandidate';

/**
 * Extension point for AI-assisted locator healing, consulted only when deterministic fingerprint
 * matching (LocatorHealingEngine) finds no candidate above its confidence threshold. No concrete
 * implementation exists yet — consistent with the rest of the platform's Gemini integration being
 * scaffolded but not live — so a future IGeminiClient-backed implementation can be injected
 * without any change to LocatorHealingEngine. Returns null if it cannot suggest a match either.
 */
export interface IAiLocatorHealingFallback {
  heal(element: Element, candidates: Element[]): Promise<LocatorCandidate[] | null>;
}
