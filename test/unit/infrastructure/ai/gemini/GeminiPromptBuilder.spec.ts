import { GeminiPromptBuilder } from '../../../../../src/infrastructure/ai/gemini/GeminiPromptBuilder';

describe('GeminiPromptBuilder', () => {
  it('builds a request body with the prompt as user content and JSON response mode forced', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(builder.build({ prompt: 'Describe this screen.' }));

    expect(body).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'Describe this screen.' }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });
  });

  it('includes a systemInstruction block when provided', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(
      builder.build({
        prompt: 'Describe this screen.',
        systemInstruction: 'You are a QA assistant.',
      }),
    );

    expect(body.systemInstruction).toEqual({
      role: 'system',
      parts: [{ text: 'You are a QA assistant.' }],
    });
  });

  it('omits systemInstruction entirely when not provided', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(builder.build({ prompt: 'Describe this screen.' }));

    expect(body.systemInstruction).toBeUndefined();
  });

  it('always sets responseMimeType to application/json, regardless of prompt content', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(builder.build({ prompt: 'Reply in plain English, not JSON.' }));

    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('appends image parts after the text part when images are provided', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(
      builder.build({
        prompt: 'Describe this screen.',
        images: [{ mimeType: 'image/png', data: 'ZmFrZS1wbmctYnl0ZXM=' }],
      }),
    );

    expect(body.contents[0].parts).toEqual([
      { text: 'Describe this screen.' },
      { inlineData: { mimeType: 'image/png', data: 'ZmFrZS1wbmctYnl0ZXM=' } },
    ]);
  });

  it('includes multiple images in order when provided', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(
      builder.build({
        prompt: 'Compare these two screens.',
        images: [
          { mimeType: 'image/png', data: 'aW1hZ2Ux' },
          { mimeType: 'image/png', data: 'aW1hZ2Uy' },
        ],
      }),
    );

    expect(body.contents[0].parts).toHaveLength(3);
    expect(body.contents[0].parts[1].inlineData.data).toBe('aW1hZ2Ux');
    expect(body.contents[0].parts[2].inlineData.data).toBe('aW1hZ2Uy');
  });

  it('omits image parts entirely when no images are provided', () => {
    const builder = new GeminiPromptBuilder();

    const body = JSON.parse(builder.build({ prompt: 'Describe this screen.' }));

    expect(body.contents[0].parts).toEqual([{ text: 'Describe this screen.' }]);
  });
});
