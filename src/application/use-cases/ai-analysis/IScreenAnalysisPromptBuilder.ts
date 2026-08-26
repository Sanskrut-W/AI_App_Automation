export interface ScreenAnalysisPromptInput {
  xml: string;
  packageName: string;
  activityName: string;
}

export interface IScreenAnalysisPromptBuilder {
  build(input: ScreenAnalysisPromptInput): string;
}
