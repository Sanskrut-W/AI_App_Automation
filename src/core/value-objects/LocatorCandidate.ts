import { LocatorStrategy } from '../enums/LocatorStrategy';

export interface LocatorCandidate {
  strategy: LocatorStrategy;
  value: string;
  /** Lower number = higher priority (tried first). */
  priority: number;
}
