import { Platform } from '../enums/Platform';

export interface ApplicationProps {
  packageName: string;
  versionName: string;
  versionCode: string;
  appLabel: string;
  launcherActivity: string | null;
  apkPath: string;
  platform: Platform;
}

export class Application {
  readonly packageName: string;
  readonly versionName: string;
  readonly versionCode: string;
  readonly appLabel: string;
  readonly launcherActivity: string | null;
  readonly apkPath: string;
  readonly platform: Platform;

  constructor(props: ApplicationProps) {
    if (!props.packageName) {
      throw new Error('Application requires a non-empty packageName.');
    }

    this.packageName = props.packageName;
    this.versionName = props.versionName;
    this.versionCode = props.versionCode;
    this.appLabel = props.appLabel;
    this.launcherActivity = props.launcherActivity;
    this.apkPath = props.apkPath;
    this.platform = props.platform;
  }
}
