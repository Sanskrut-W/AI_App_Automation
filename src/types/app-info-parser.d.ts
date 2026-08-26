declare module 'app-info-parser' {
  export interface ApkManifestActivity {
    name?: string;
    [key: string]: unknown;
  }

  export interface ApkApplicationInfo {
    label?: string;
    icon?: string | string[];
    activities?: ApkManifestActivity[];
    launcherActivities?: ApkManifestActivity[];
    [key: string]: unknown;
  }

  export interface ApkParseResult {
    package?: string;
    versionName?: string | number;
    versionCode?: string | number;
    application?: ApkApplicationInfo;
    icon?: string;
    [key: string]: unknown;
  }

  export default class AppInfoParser {
    constructor(filePath: string);
    parse(): Promise<ApkParseResult>;
  }
}
