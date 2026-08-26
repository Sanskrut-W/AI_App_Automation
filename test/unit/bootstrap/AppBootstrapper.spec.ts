import { bootstrap } from '../../../src/bootstrap/AppBootstrapper';

describe('bootstrap', () => {
  it('initializes config and logger without throwing', () => {
    expect(() => bootstrap()).not.toThrow();
  });

  it('returns a working config provider and logger', () => {
    const { config, logger } = bootstrap();

    expect(typeof config.get).toBe('function');
    expect(typeof config.validate).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.child).toBe('function');
  });
});
