import { AiScreenAnalyzer } from '../../../../../src/application/use-cases/ai-analysis/AiScreenAnalyzer';
import { IGeminiClient } from '../../../../../src/application/interfaces/ai/IGeminiClient';
import { IScreenAnalysisPromptBuilder } from '../../../../../src/application/use-cases/ai-analysis/IScreenAnalysisPromptBuilder';
import { IFileReader } from '../../../../../src/shared/fs/IFileReader';
import { ScreenAnalysisError } from '../../../../../src/core/errors/ScreenAnalysisError';
import { Result } from '../../../../../src/shared/result/Result';
import { GeminiClientError } from '../../../../../src/core/errors/GeminiClientError';
import { createMockLogger } from '../../../support/createMockLogger';

const VALID_ANALYSIS = {
  screenName: 'Home',
  screenPurpose: 'Lets the user perform a calculation.',
  navigationOptions: ['Settings'],
  importantElements: ['Calculate button'],
  suggestedTestAreas: ['Division by zero'],
};

function createMocks() {
  const geminiClient: jest.Mocked<IGeminiClient> = { generateJson: jest.fn() };
  const promptBuilder: jest.Mocked<IScreenAnalysisPromptBuilder> = {
    build: jest.fn().mockReturnValue('built-prompt'),
  };
  const fileReader: jest.Mocked<IFileReader> = {
    read: jest.fn().mockResolvedValue('<hierarchy/>'),
    readBinary: jest.fn().mockResolvedValue(Buffer.from('fake-png-bytes')),
  };
  const logger = createMockLogger();

  return { geminiClient, promptBuilder, fileReader, logger };
}

function createAnalyzer(mocks: ReturnType<typeof createMocks>) {
  return new AiScreenAnalyzer(
    mocks.geminiClient,
    mocks.promptBuilder,
    mocks.fileReader,
    mocks.logger,
  );
}

const REQUEST = {
  screenshotPath: '/artifacts/screenshots/screen-1.png',
  xmlPath: '/artifacts/xml-dumps/screen-1.xml',
  packageName: 'com.example.calculator',
  activityName: '.MainActivity',
};

describe('AiScreenAnalyzer', () => {
  it('reads the XML and screenshot, builds the prompt, and returns validated analysis on success', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok(VALID_ANALYSIS));
    const analyzer = createAnalyzer(mocks);

    const result = await analyzer.analyze(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual(VALID_ANALYSIS);

    expect(mocks.fileReader.read).toHaveBeenCalledWith(REQUEST.xmlPath);
    expect(mocks.fileReader.readBinary).toHaveBeenCalledWith(REQUEST.screenshotPath);
    expect(mocks.promptBuilder.build).toHaveBeenCalledWith({
      xml: '<hierarchy/>',
      packageName: REQUEST.packageName,
      activityName: REQUEST.activityName,
    });
    expect(mocks.geminiClient.generateJson).toHaveBeenCalledWith({
      prompt: 'built-prompt',
      images: [{ mimeType: 'image/png', data: Buffer.from('fake-png-bytes').toString('base64') }],
    });
  });

  it('returns a ScreenAnalysisError when the Gemini client itself fails', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(
      Result.err(new GeminiClientError('Gemini request failed: network error')),
    );
    const analyzer = createAnalyzer(mocks);

    const result = await analyzer.analyze(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenAnalysisError);
    expect(result.unwrapErr().message).toMatch(/network error/);
  });

  it('rejects a Gemini response that is valid JSON but fails schema validation', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(
      Result.ok({ message: 'This looks like a login screen.' }),
    );
    const analyzer = createAnalyzer(mocks);

    const result = await analyzer.analyze(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenAnalysisError);
    expect(result.unwrapErr().message).toMatch(/schema validation/);
  });

  it('rejects a Gemini response missing a required field', async () => {
    const mocks = createMocks();
    const { screenPurpose: _omit, ...incomplete } = VALID_ANALYSIS;
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok(incomplete));
    const analyzer = createAnalyzer(mocks);

    const result = await analyzer.analyze(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenAnalysisError);
  });

  it('returns a ScreenAnalysisError when reading the XML file fails', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockRejectedValue(new Error('ENOENT'));
    const analyzer = createAnalyzer(mocks);

    const result = await analyzer.analyze(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenAnalysisError);
    expect(mocks.geminiClient.generateJson).not.toHaveBeenCalled();
  });

  it('returns a ScreenAnalysisError when reading the screenshot file fails', async () => {
    const mocks = createMocks();
    mocks.fileReader.readBinary.mockRejectedValue(new Error('ENOENT'));
    const analyzer = createAnalyzer(mocks);

    const result = await analyzer.analyze(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenAnalysisError);
    expect(mocks.geminiClient.generateJson).not.toHaveBeenCalled();
  });
});
