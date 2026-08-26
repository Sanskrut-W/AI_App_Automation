import { ElementBounds } from '../value-objects/ElementBounds';
import { LocatorCandidate } from '../value-objects/LocatorCandidate';

export interface ElementProps {
  elementId: string;
  screenId: string;
  className: string;
  text: string;
  resourceId: string;
  /** Value to use for the "accessibility id" locator strategy. On Android this is the content-desc. */
  accessibilityId: string;
  contentDescription: string;
  bounds: ElementBounds;
  clickable: boolean;
  enabled: boolean;
  selected: boolean;
  checked: boolean;
  /** True for a password-style text input (Android's "password" XML attribute) — distinguishes it from a plain text/number input like a username or phone field. */
  isPassword: boolean;
  parentElementId: string | null;
  childElementIds: string[];
  /** Candidate locators for this element, ranked by priority (lower = tried first). */
  locators: LocatorCandidate[];
}

export class Element {
  readonly elementId: string;
  readonly screenId: string;
  readonly className: string;
  readonly text: string;
  readonly resourceId: string;
  readonly accessibilityId: string;
  readonly contentDescription: string;
  readonly bounds: ElementBounds;
  readonly clickable: boolean;
  readonly enabled: boolean;
  readonly selected: boolean;
  readonly checked: boolean;
  readonly isPassword: boolean;
  readonly parentElementId: string | null;
  readonly childElementIds: string[];
  readonly locators: LocatorCandidate[];

  constructor(props: ElementProps) {
    if (!props.elementId) {
      throw new Error('Element requires a non-empty elementId.');
    }
    if (!props.screenId) {
      throw new Error('Element requires a non-empty screenId.');
    }

    this.elementId = props.elementId;
    this.screenId = props.screenId;
    this.className = props.className;
    this.text = props.text;
    this.resourceId = props.resourceId;
    this.accessibilityId = props.accessibilityId;
    this.contentDescription = props.contentDescription;
    this.bounds = props.bounds;
    this.clickable = props.clickable;
    this.enabled = props.enabled;
    this.selected = props.selected;
    this.checked = props.checked;
    this.isPassword = props.isPassword;
    this.parentElementId = props.parentElementId;
    this.childElementIds = props.childElementIds;
    this.locators = props.locators;
  }
}
