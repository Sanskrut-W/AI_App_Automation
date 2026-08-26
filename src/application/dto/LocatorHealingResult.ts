import { LocatorCandidate } from '../../core/value-objects/LocatorCandidate';

export interface LocatorHealingResult {
  elementId: string;
  healed: boolean;
  /** Fingerprint similarity score (0-1) of the best deterministic match found, regardless of outcome. */
  confidence: number;
  /** Transient id of the matched element in the freshly-parsed XML, for diagnostics only. */
  matchedElementId: string | null;
  updatedLocators: LocatorCandidate[] | null;
  /** True if healing succeeded only via the AI fallback (deterministic matching found nothing confident enough). */
  aiAssisted: boolean;
}
