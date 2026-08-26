export enum DeviceState {
  /** No device with this id is currently visible to adb. */
  NOT_FOUND = 'not_found',
  OFFLINE = 'offline',
  UNAUTHORIZED = 'unauthorized',
  /** adb-reachable ("adb devices" reports "device"); Android itself may still be booting. */
  DEVICE = 'device',
  /** DEVICE, but sys.boot_completed is not yet 1. Only produced by getStatus()/waitForBootCompleted(). */
  BOOTING = 'booting',
  /** DEVICE and sys.boot_completed == 1. Only produced by getStatus()/waitForBootCompleted(). */
  ONLINE = 'online',
  UNKNOWN = 'unknown',
}
