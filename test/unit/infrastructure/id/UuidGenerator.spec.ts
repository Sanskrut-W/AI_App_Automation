import { UuidGenerator } from '../../../../src/infrastructure/id/UuidGenerator';

describe('UuidGenerator', () => {
  it('generates a valid v4 UUID', () => {
    const generator = new UuidGenerator();

    const id = generator.generate();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates unique values across calls', () => {
    const generator = new UuidGenerator();

    const first = generator.generate();
    const second = generator.generate();

    expect(first).not.toBe(second);
  });
});
