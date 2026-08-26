import { Platform } from '../enums/Platform';

export interface AppiumSessionProps {
  sessionId: string;
  deviceId: string;
  platform: Platform;
}

export class AppiumSession {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly platform: Platform;

  constructor(props: AppiumSessionProps) {
    if (!props.sessionId) {
      throw new Error('AppiumSession requires a non-empty sessionId.');
    }

    this.sessionId = props.sessionId;
    this.deviceId = props.deviceId;
    this.platform = props.platform;
  }
}
