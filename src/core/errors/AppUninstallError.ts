import { DomainError } from './DomainError';

export class AppUninstallError extends DomainError {
  readonly code = 'APP_UNINSTALL_ERROR';
}
