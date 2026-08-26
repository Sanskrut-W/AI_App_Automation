import { DomainError } from './DomainError';

export class LocatorHealingError extends DomainError {
  readonly code = 'LOCATOR_HEALING_ERROR';
}
