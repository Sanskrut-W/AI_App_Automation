import { ScreenAnalysisResult } from './ScreenAnalysisResult';

export interface TestCaseGenerationRequest {
  screenId: string;
  screenAnalysis: ScreenAnalysisResult;
  /** Stamped onto every generated TestCase (Application.versionName/versionCode). */
  appVersionName: string;
  appVersionCode: string;
}
