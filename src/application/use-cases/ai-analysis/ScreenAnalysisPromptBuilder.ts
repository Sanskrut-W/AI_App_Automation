import {
  IScreenAnalysisPromptBuilder,
  ScreenAnalysisPromptInput,
} from './IScreenAnalysisPromptBuilder';

/** Builds the text instructions Gemini receives alongside the screenshot image. Gemini-agnostic — just produces a prompt string. */
export class ScreenAnalysisPromptBuilder implements IScreenAnalysisPromptBuilder {
  build(input: ScreenAnalysisPromptInput): string {
    return [
      'You are analyzing a single screen of an Android application to help a QA engineer understand it.',
      "You are given the screen's XML UI hierarchy below and a screenshot image attached to this request.",
      '',
      `App package: ${input.packageName}`,
      `Activity: ${input.activityName}`,
      '',
      'Respond with ONLY a single JSON object (no markdown, no commentary, no code fences) matching exactly this shape:',
      '{',
      '  "screenName": string,',
      '  "screenPurpose": string,',
      '  "navigationOptions": string[],',
      '  "importantElements": string[],',
      '  "suggestedTestAreas": string[]',
      '}',
      '',
      'Field guidance:',
      '- screenName: a short, human-readable name for this screen.',
      '- screenPurpose: one or two sentences describing what this screen is for.',
      '- navigationOptions: where a user could navigate to from this screen (button/menu labels).',
      '- importantElements: the most functionally significant UI elements on this screen, described in plain language.',
      '- suggestedTestAreas: aspects of this screen worth testing. Describe areas only — do not write test steps, code, or executable instructions.',
      '',
      'XML hierarchy:',
      input.xml,
    ].join('\n');
  }
}
