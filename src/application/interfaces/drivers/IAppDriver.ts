export interface IAppDriver {
  install(deviceId: string, apkPath: string): Promise<void>;
  uninstall(deviceId: string, packageName: string): Promise<void>;
  launch(deviceId: string, packageName: string, activity?: string | null): Promise<void>;
  terminate(deviceId: string, packageName: string): Promise<void>;
  isInstalled(deviceId: string, packageName: string): Promise<boolean>;
}
