export interface ApkMetadataDto {
  packageName: string;
  versionName: string;
  versionCode: string;
  appLabel: string;
  launcherActivity: string | null;
}
