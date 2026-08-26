import { CrawlRequest } from '../../dto/CrawlRequest';
import { CrawlSummary } from '../../dto/CrawlSummary';
import { CrawlError } from '../../../core/errors/CrawlError';
import { Result } from '../../../shared/result/Result';

export interface IScreenCrawler {
  crawl(request: CrawlRequest): Promise<Result<CrawlSummary, CrawlError>>;
}
