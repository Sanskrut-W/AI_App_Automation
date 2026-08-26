import { DeviceState } from '../enums/DeviceState';

export interface DeviceProps {
  deviceId: string;
  isEmulator: boolean;
  state: DeviceState;
}

export class Device {
  readonly deviceId: string;
  readonly isEmulator: boolean;
  readonly state: DeviceState;

  constructor(props: DeviceProps) {
    if (!props.deviceId) {
      throw new Error('Device requires a non-empty deviceId.');
    }

    this.deviceId = props.deviceId;
    this.isEmulator = props.isEmulator;
    this.state = props.state;
  }
}
