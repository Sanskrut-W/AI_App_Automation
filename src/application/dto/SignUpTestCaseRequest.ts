import { NavigationGraph } from './NavigationGraph';

export interface SignUpTestCaseRequest {
  navigationGraph: NavigationGraph;
  appVersionName: string;
  appVersionCode: string;
}
