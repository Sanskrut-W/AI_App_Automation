export interface ScreenProps {
  screenId: string;
  screenName: string;
  screenshotPath: string;
  xmlPath: string;
  packageName: string;
  activityName: string;
  /** screenId of the screen this one was first reached from, or null for a root screen. */
  parentScreenId: string | null;
  /** Sequence of screenIds from the root screen down to (and including) this one. */
  navigationPath: string[];
  /** ISO-8601 timestamp of when this screen was first discovered. Immutable once set. */
  discoveredAt: string;
  /** Structural signature (className/resourceId/text/clickable of every element) used to recognize this same screen again across separate crawl runs. */
  structuralHash: string;
}

export class Screen {
  readonly screenId: string;
  readonly screenName: string;
  readonly screenshotPath: string;
  readonly xmlPath: string;
  readonly packageName: string;
  readonly activityName: string;
  readonly parentScreenId: string | null;
  readonly navigationPath: string[];
  readonly discoveredAt: string;
  readonly structuralHash: string;

  constructor(props: ScreenProps) {
    if (!props.screenId) {
      throw new Error('Screen requires a non-empty screenId.');
    }

    this.screenId = props.screenId;
    this.screenName = props.screenName;
    this.screenshotPath = props.screenshotPath;
    this.xmlPath = props.xmlPath;
    this.packageName = props.packageName;
    this.activityName = props.activityName;
    this.parentScreenId = props.parentScreenId;
    this.navigationPath = props.navigationPath;
    this.discoveredAt = props.discoveredAt;
    this.structuralHash = props.structuralHash;
  }
}
