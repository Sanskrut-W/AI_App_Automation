export interface NavigationGraphEdge {
  fromScreenId: string;
  toScreenId: string;
  /** The element that was tapped to cause this transition. */
  elementId: string;
}

export interface NavigationGraph {
  rootScreenId: string;
  screenIds: string[];
  edges: NavigationGraphEdge[];
}
