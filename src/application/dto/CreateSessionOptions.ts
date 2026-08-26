export interface CreateSessionOptions {
  deviceId: string;
  appPackage?: string;
  appActivity?: string;
  noReset?: boolean;
  capabilityOverrides?: Record<string, unknown>;
}
