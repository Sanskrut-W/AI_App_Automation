/** screenId/className/resourceId/accessibilityId match exactly; text/contentDescription match case-insensitive substrings. */
export interface ElementSearchCriteria {
  screenId?: string;
  className?: string;
  text?: string;
  resourceId?: string;
  accessibilityId?: string;
  contentDescription?: string;
  clickable?: boolean;
  enabled?: boolean;
  selected?: boolean;
  checked?: boolean;
}
