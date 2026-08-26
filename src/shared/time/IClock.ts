export interface IClock {
  /** Returns the current time as an ISO-8601 string. */
  now(): string;
  /** Returns the current time as epoch milliseconds — for window/duration arithmetic. */
  nowMs(): number;
}
