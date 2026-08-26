import { IClock } from '../../shared/time/IClock';

export class SystemClock implements IClock {
  now(): string {
    return new Date().toISOString();
  }

  nowMs(): number {
    return Date.now();
  }
}
