import { DomainError } from './DomainError';

export class AppInstallationError extends DomainError {
  readonly code = 'APP_INSTALLATION_ERROR';
}
