export interface ScreenFingerprintComponents {
  packageName: string;
  activityName: string;
  /** Sorted hashes of every element fingerprint on the screen. */
  elementHashes: string[];
  elementCount: number;
}

export interface ScreenFingerprint {
  screenId: string;
  hash: string;
  components: ScreenFingerprintComponents;
}
