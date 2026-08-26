import { NavigationGraph } from './NavigationGraph';

export interface LoginTestCaseRequest {
  navigationGraph: NavigationGraph;
  appVersionName: string;
  appVersionCode: string;
  mobileNumber: string;
  password: string;
}
