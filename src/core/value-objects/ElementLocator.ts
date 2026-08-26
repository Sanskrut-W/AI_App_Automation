import { LocatorStrategy } from '../enums/LocatorStrategy';

/** A single locator to act on (no priority) — as opposed to LocatorCandidate, which is a ranked storage record. */
export interface ElementLocator {
  strategy: LocatorStrategy;
  value: string;
}
