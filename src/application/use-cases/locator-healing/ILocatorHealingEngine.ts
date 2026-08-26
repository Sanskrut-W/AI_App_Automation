import { LocatorHealingError } from '../../../core/errors/LocatorHealingError';
import { Result } from '../../../shared/result/Result';
import { LocatorHealingRequest } from '../../dto/LocatorHealingRequest';
import { LocatorHealingResult } from '../../dto/LocatorHealingResult';

export interface ILocatorHealingEngine {
  heal(request: LocatorHealingRequest): Promise<Result<LocatorHealingResult, LocatorHealingError>>;
}
