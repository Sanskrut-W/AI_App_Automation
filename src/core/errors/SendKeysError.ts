import { DomainError } from './DomainError';

export class SendKeysError extends DomainError {
  readonly code = 'SEND_KEYS_ERROR';
}
