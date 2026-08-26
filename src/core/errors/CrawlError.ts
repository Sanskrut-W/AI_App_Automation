import { DomainError } from './DomainError';

export class CrawlError extends DomainError {
  readonly code = 'CRAWL_ERROR';
}
