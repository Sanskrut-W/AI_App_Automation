import { bootstrap } from '../../../src/bootstrap/AppBootstrapper';
import { buildCompositionRoot } from '../../../src/bootstrap/CompositionRoot';

describe('buildCompositionRoot', () => {
  it('wires every module into a working IPipelineOrchestrator without throwing', () => {
    const { config, logger } = bootstrap();

    expect(() => buildCompositionRoot(config, logger)).not.toThrow();
  });

  it('returns an orchestrator exposing run(), even when Gemini is not configured', () => {
    const { config, logger } = bootstrap();

    const { pipelineOrchestrator } = buildCompositionRoot(config, logger);

    expect(typeof pipelineOrchestrator.run).toBe('function');
  });

  it('exposes importManualTestCases() even when Gemini is not configured (it fails only when actually invoked)', () => {
    const { config, logger } = bootstrap();

    const { pipelineOrchestrator } = buildCompositionRoot(config, logger);

    expect(typeof pipelineOrchestrator.importManualTestCases).toBe('function');
  });

  it('accepts maxScreens/maxDepth crawl-limit options without throwing', () => {
    const { config, logger } = bootstrap();

    expect(() =>
      buildCompositionRoot(config, logger, { maxScreens: 8, maxDepth: 5 }),
    ).not.toThrow();
  });
});
