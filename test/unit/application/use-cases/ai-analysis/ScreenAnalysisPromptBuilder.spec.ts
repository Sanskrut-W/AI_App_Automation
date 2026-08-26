import { ScreenAnalysisPromptBuilder } from '../../../../../src/application/use-cases/ai-analysis/ScreenAnalysisPromptBuilder';

describe('ScreenAnalysisPromptBuilder', () => {
  it('includes the package name, activity name, and XML content in the prompt', () => {
    const builder = new ScreenAnalysisPromptBuilder();

    const prompt = builder.build({
      xml: '<hierarchy><node text="Calculate"/></hierarchy>',
      packageName: 'com.example.calculator',
      activityName: '.MainActivity',
    });

    expect(prompt).toContain('com.example.calculator');
    expect(prompt).toContain('.MainActivity');
    expect(prompt).toContain('<hierarchy><node text="Calculate"/></hierarchy>');
  });

  it('instructs the model to respond with only a JSON object matching the five required fields', () => {
    const builder = new ScreenAnalysisPromptBuilder();

    const prompt = builder.build({
      xml: '<hierarchy/>',
      packageName: 'com.example.app',
      activityName: '.A',
    });

    expect(prompt).toMatch(/ONLY a single JSON object/i);
    expect(prompt).toContain('"screenName"');
    expect(prompt).toContain('"screenPurpose"');
    expect(prompt).toContain('"navigationOptions"');
    expect(prompt).toContain('"importantElements"');
    expect(prompt).toContain('"suggestedTestAreas"');
  });

  it('explicitly instructs the model not to write test steps or code', () => {
    const builder = new ScreenAnalysisPromptBuilder();

    const prompt = builder.build({
      xml: '<hierarchy/>',
      packageName: 'com.example.app',
      activityName: '.A',
    });

    expect(prompt.toLowerCase()).toContain('do not write test steps');
  });
});
