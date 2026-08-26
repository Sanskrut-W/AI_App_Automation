import { ElementBounds } from './ElementBounds';

export interface ElementFingerprintComponents {
  className: string;
  text: string;
  resourceId: string;
  accessibilityId: string;
  bounds: ElementBounds;
  /** className of the parent element, or '' for a root element. */
  parentClassName: string;
  /** Sorted classNames of direct children. */
  childClassNames: string[];
  /** Index among the parent's children (0 for a root element). */
  position: number;
  clickable: boolean;
}

export interface ElementFingerprint {
  elementId: string;
  hash: string;
  components: ElementFingerprintComponents;
}
