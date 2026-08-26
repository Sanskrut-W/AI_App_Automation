import { NavigationGraph } from './NavigationGraph';

export interface CrawlSummary {
  rootScreenId: string;
  screensDiscovered: number;
  visitedElementIds: string[];
  navigationGraph: NavigationGraph;
}
