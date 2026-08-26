import { DomainError } from './DomainError';

export class AppLaunchError extends DomainError {
  readonly code = 'APP_LAUNCH_ERROR';
}
