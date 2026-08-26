import { StepInterpreter } from '../../../../../src/application/use-cases/step-interpretation/StepInterpreter';
import { IGeminiClient } from '../../../../../src/application/interfaces/ai/IGeminiClient';
import { IStepInterpretationPromptBuilder } from '../../../../../src/application/use-cases/step-interpretation/IStepInterpretationPromptBuilder';
import { IFileReader } from '../../../../../src/shared/fs/IFileReader';
import { StepInterpretationError } from '../../../../../src/core/errors/StepInterpretationError';
import { Result } from '../../../../../src/shared/result/Result';
import { GeminiClientError } from '../../../../../src/core/errors/GeminiClientError';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { createMockLogger } from '../../../support/createMockLogger';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Login',
    resourceId: 'com.example.app:id/login',
    accessibilityId: '',
    contentDescription: '',
    bounds: { left: 0, top: 0, right: 100, bottom: 50 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: null,
    childElementIds: [],
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
    ],
    ...overrides,
  });
}

const VALID_RESULT = {
  applicable: true,
  reason: null,
  actions: [
    { action: 'click', candidateIndex: 0, fieldType: 'none', literalValue: null, direction: null },
  ],
  expectedResultCheck: null,
};

function createMocks() {
  const geminiClient: jest.Mocked<IGeminiClient> = { generateJson: jest.fn() };
  const promptBuilder: jest.Mocked<IStepInterpretationPromptBuilder> = {
    build: jest.fn().mockReturnValue('built-prompt'),
  };
  const fileReader: jest.Mocked<IFileReader> = {
    read: jest.fn(),
    readBinary: jest.fn().mockResolvedValue(Buffer.from('fake-png-bytes')),
  };
  const logger = createMockLogger();

  return { geminiClient, promptBuilder, fileReader, logger };
}

function createInterpreter(mocks: ReturnType<typeof createMocks>) {
  return new StepInterpreter(
    mocks.geminiClient,
    mocks.promptBuilder,
    mocks.fileReader,
    mocks.logger,
  );
}

const REQUEST = {
  stepDescription: 'click login button',
  expectedResult: 'user should get logged in',
  candidateElements: [createElement()],
  screenshotPath: '/artifacts/apps/com.example.app/screenshots/screen-1.png',
};

describe('StepInterpreter', () => {
  it('reads the screenshot, builds the prompt, and returns validated interpretation on success', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok(VALID_RESULT));
    const interpreter = createInterpreter(mocks);

    const result = await interpreter.interpret(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual(VALID_RESULT);
    expect(mocks.fileReader.readBinary).toHaveBeenCalledWith(REQUEST.screenshotPath);
    expect(mocks.promptBuilder.build).toHaveBeenCalledWith({
      stepDescription: REQUEST.stepDescription,
      expectedResult: REQUEST.expectedResult,
      candidateElements: REQUEST.candidateElements,
    });
    expect(mocks.geminiClient.generateJson).toHaveBeenCalledWith({
      prompt: 'built-prompt',
      images: [{ mimeType: 'image/png', data: Buffer.from('fake-png-bytes').toString('base64') }],
    });
  });

  it('nulls out an out-of-range candidateIndex instead of trusting Gemini to stay in bounds', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(
      Result.ok({
        applicable: true,
        reason: null,
        actions: [
          {
            action: 'click',
            candidateIndex: 5,
            fieldType: 'none',
            literalValue: null,
            direction: null,
          },
        ],
        expectedResultCheck: { candidateIndex: 9, confidence: 0.9 },
      }),
    );
    const interpreter = createInterpreter(mocks);

    const result = await interpreter.interpret(REQUEST); // only 1 candidate, index 0

    const value = result.unwrap();
    expect(value.actions[0].candidateIndex).toBeNull();
    expect(value.expectedResultCheck).toBeNull();
  });

  it('returns a StepInterpretationError when the Gemini client itself fails', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(
      Result.err(new GeminiClientError('Gemini request failed: network error')),
    );
    const interpreter = createInterpreter(mocks);

    const result = await interpreter.interpret(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(StepInterpretationError);
    expect(result.unwrapErr().message).toMatch(/network error/);
  });

  it('rejects a Gemini response that is valid JSON but fails schema validation', async () => {
    const mocks = createMocks();
    mocks.geminiClient.generateJson.mockResolvedValue(Result.ok({ foo: 'bar' }));
    const interpreter = createInterpreter(mocks);

    const result = await interpreter.interpret(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(StepInterpretationError);
    expect(result.unwrapErr().message).toMatch(/schema validation/);
  });

  it('returns a StepInterpretationError when reading the screenshot fails', async () => {
    const mocks = createMocks();
    mocks.fileReader.readBinary.mockRejectedValue(new Error('ENOENT'));
    const interpreter = createInterpreter(mocks);

    const result = await interpreter.interpret(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(StepInterpretationError);
    expect(mocks.geminiClient.generateJson).not.toHaveBeenCalled();
  });
});
