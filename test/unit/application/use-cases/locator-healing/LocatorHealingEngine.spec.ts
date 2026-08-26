import { LocatorHealingEngine } from '../../../../../src/application/use-cases/locator-healing/LocatorHealingEngine';
import { IElementRepository } from '../../../../../src/application/interfaces/repositories/IElementRepository';
import { IXmlElementParser } from '../../../../../src/application/interfaces/xml/IXmlElementParser';
import { IFingerprintEngine } from '../../../../../src/application/use-cases/fingerprint/IFingerprintEngine';
import { IAiLocatorHealingFallback } from '../../../../../src/application/interfaces/ai/IAiLocatorHealingFallback';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { ElementFingerprint } from '../../../../../src/core/value-objects/ElementFingerprint';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { LocatorHealingError } from '../../../../../src/core/errors/LocatorHealingError';
import { createMockLogger } from '../../../support/createMockLogger';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Calculate',
    resourceId: 'com.example.app:id/btnCalculate',
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
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/btnCalculate',
        priority: 1,
      },
    ],
    ...overrides,
  });
}

function fingerprintFor(elementId: string): ElementFingerprint {
  return {
    elementId,
    hash: elementId,
    components: {
      className: '',
      text: '',
      resourceId: '',
      accessibilityId: '',
      bounds: { left: 0, top: 0, right: 0, bottom: 0 },
      parentClassName: '',
      childClassNames: [],
      position: 0,
      clickable: false,
    },
  };
}

function createMocks() {
  const elementRepository: jest.Mocked<IElementRepository> = {
    add: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    search: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const xmlParser: jest.Mocked<IXmlElementParser> = { parse: jest.fn().mockReturnValue([]) };
  const fingerprintEngine: jest.Mocked<IFingerprintEngine> = {
    fingerprintElement: jest.fn((element: Element, _allElementsOnScreen: Element[]) =>
      fingerprintFor(element.elementId),
    ),
    fingerprintScreen: jest.fn(),
    elementSimilarity: jest.fn().mockReturnValue(0),
    screenSimilarity: jest.fn(),
    isDuplicateElement: jest.fn(),
    isDuplicateScreen: jest.fn(),
  };
  const logger = createMockLogger();

  return { elementRepository, xmlParser, fingerprintEngine, logger };
}

function createEngine(
  mocks: ReturnType<typeof createMocks>,
  aiFallback?: jest.Mocked<IAiLocatorHealingFallback>,
) {
  return new LocatorHealingEngine(
    mocks.elementRepository,
    mocks.xmlParser,
    mocks.fingerprintEngine,
    mocks.logger,
    aiFallback,
  );
}

const REQUEST = { elementId: 'element-1', currentXml: '<hierarchy/>' };

describe('LocatorHealingEngine', () => {
  it("self-heals via the element's own coordinates locator without touching the repository or consulting AI", async () => {
    const mocks = createMocks();
    const storedElement = createElement({
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/btnCalculate',
          priority: 1,
        },
        { strategy: LocatorStrategy.COORDINATES, value: '50,25', priority: 5 },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(storedElement);
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    const healing = result.unwrap();
    expect(healing.healed).toBe(true);
    expect(healing.confidence).toBe(1);
    expect(healing.matchedElementId).toBe('element-1');
    expect(healing.updatedLocators).toEqual([
      { strategy: LocatorStrategy.COORDINATES, value: '50,25', priority: 5 },
    ]);
    expect(healing.aiAssisted).toBe(false);
    // The current screen is still parsed once up front (to refuse healing on a real-money
    // screen) even when the coordinate self-heal ends up handling the request — but nothing
    // beyond that early safety check is done with it, so the repository stays untouched.
    expect(mocks.xmlParser.parse).toHaveBeenCalledTimes(1);
    expect(mocks.elementRepository.update).not.toHaveBeenCalled();
  });

  it('does not self-heal when coordinates is the only locator the element has', async () => {
    const mocks = createMocks();
    const storedElement = createElement({
      locators: [{ strategy: LocatorStrategy.COORDINATES, value: '50,25', priority: 5 }],
    });
    mocks.elementRepository.findById.mockResolvedValue(storedElement);
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.1);
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    expect(mocks.xmlParser.parse).toHaveBeenCalled();
    expect(result.unwrap().confidence).toBe(0.1);
  });

  it('does not self-heal via coordinates for a custom (non-standard-widget) element class, even when a coordinates locator exists', async () => {
    // Verified live: a custom android.view.View-based popup/dropdown list item can visually be
    // "tapped" at its cached coordinates without ever triggering its real click listener — the
    // gesture looks like it worked but silently selects nothing. Coordinate self-heal is only
    // trusted for standard widget classes (Button, EditText, CheckBox, TextView, Spinner).
    const mocks = createMocks();
    const storedElement = createElement({
      className: 'android.view.View',
      locators: [
        { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Salary', priority: 2 },
        { strategy: LocatorStrategy.COORDINATES, value: '50,25', priority: 5 },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(storedElement);
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.1);
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    // Falls through to real fingerprint re-identification instead of the cheap coordinates path.
    expect(mocks.xmlParser.parse).toHaveBeenCalled();
    expect(result.unwrap().confidence).toBe(0.1);
    expect(result.unwrap().updatedLocators).not.toEqual([
      { strategy: LocatorStrategy.COORDINATES, value: '50,25', priority: 5 },
    ]);
  });

  it('updates the element repository with the best candidate above the confidence threshold', async () => {
    const mocks = createMocks();
    const storedElement = createElement();
    const candidateA = createElement({
      elementId: 'candidate-a',
      locators: [{ strategy: LocatorStrategy.XPATH_CLASS_INDEX, value: '/x[1]', priority: 4 }],
    });
    const candidateB = createElement({
      elementId: 'candidate-b',
      locators: [{ strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Calculate', priority: 2 }],
    });
    mocks.elementRepository.findById.mockResolvedValue(storedElement);
    mocks.xmlParser.parse.mockReturnValue([candidateA, candidateB]);
    mocks.fingerprintEngine.elementSimilarity.mockImplementation(
      (_a: ElementFingerprint, b: ElementFingerprint) =>
        b.elementId === 'candidate-b' ? 0.92 : 0.1,
    );
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    expect(result.isOk()).toBe(true);
    const healing = result.unwrap();
    expect(healing.healed).toBe(true);
    expect(healing.confidence).toBe(0.92);
    expect(healing.matchedElementId).toBe('candidate-b');
    expect(healing.updatedLocators).toEqual(candidateB.locators);
    expect(healing.aiAssisted).toBe(false);
    expect(mocks.elementRepository.update).toHaveBeenCalledWith('element-1', {
      locators: candidateB.locators,
    });
  });

  it('reports healed:false without touching the repository when no candidate is confident enough', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(createElement());
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.2);
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    const healing = result.unwrap();
    expect(healing.healed).toBe(false);
    expect(healing.confidence).toBe(0.2);
    expect(healing.updatedLocators).toBeNull();
    expect(mocks.elementRepository.update).not.toHaveBeenCalled();
  });

  it('reports healed:false with zero confidence when the current XML has no elements at all', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(createElement());
    mocks.xmlParser.parse.mockReturnValue([]);
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    const healing = result.unwrap();
    expect(healing.healed).toBe(false);
    expect(healing.confidence).toBe(0);
  });

  it('falls back to AI-assisted healing when deterministic matching is not confident, marking the result aiAssisted', async () => {
    const mocks = createMocks();
    const storedElement = createElement();
    mocks.elementRepository.findById.mockResolvedValue(storedElement);
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.1);
    const aiLocators = [{ strategy: LocatorStrategy.XPATH_TEXT, value: '//text()', priority: 3 }];
    const aiFallback: jest.Mocked<IAiLocatorHealingFallback> = {
      heal: jest.fn().mockResolvedValue(aiLocators),
    };
    const engine = createEngine(mocks, aiFallback);

    const result = await engine.heal(REQUEST);

    expect(aiFallback.heal).toHaveBeenCalledWith(
      storedElement,
      expect.arrayContaining([expect.objectContaining({ elementId: 'candidate-a' })]),
    );
    const healing = result.unwrap();
    expect(healing.healed).toBe(true);
    expect(healing.aiAssisted).toBe(true);
    expect(healing.updatedLocators).toEqual(aiLocators);
    expect(mocks.elementRepository.update).toHaveBeenCalledWith('element-1', {
      locators: aiLocators,
    });
  });

  it('reports healed:false when the AI fallback also declines to suggest a match', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(createElement());
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.1);
    const aiFallback: jest.Mocked<IAiLocatorHealingFallback> = {
      heal: jest.fn().mockResolvedValue(null),
    };
    const engine = createEngine(mocks, aiFallback);

    const result = await engine.heal(REQUEST);

    const healing = result.unwrap();
    expect(healing.healed).toBe(false);
    expect(healing.aiAssisted).toBe(false);
    expect(mocks.elementRepository.update).not.toHaveBeenCalled();
  });

  it('refuses to heal when the current screen looks like a real-money flow, even when coordinate self-heal would otherwise have fired', async () => {
    const mocks = createMocks();
    const storedElement = createElement({
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/btnCalculate',
          priority: 1,
        },
        { strategy: LocatorStrategy.COORDINATES, value: '50,25', priority: 5 },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(storedElement);
    mocks.xmlParser.parse.mockReturnValue([
      createElement({ elementId: 'voucher-pin', text: 'Voucher Pin' }),
    ]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(1);
    const aiFallback: jest.Mocked<IAiLocatorHealingFallback> = {
      heal: jest
        .fn()
        .mockResolvedValue([{ strategy: LocatorStrategy.COORDINATES, value: '1,1', priority: 1 }]),
    };
    const engine = createEngine(mocks, aiFallback);

    const result = await engine.heal(REQUEST);

    const healing = result.unwrap();
    expect(healing.healed).toBe(false);
    expect(healing.confidence).toBe(0);
    expect(healing.matchedElementId).toBeNull();
    expect(healing.updatedLocators).toBeNull();
    expect(healing.aiAssisted).toBe(false);
    expect(mocks.elementRepository.update).not.toHaveBeenCalled();
    expect(aiFallback.heal).not.toHaveBeenCalled();
  });

  it('returns a LocatorHealingError when the element is not found in the repository', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(null);
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(LocatorHealingError);
    expect(result.unwrapErr().message).toMatch(/not found/);
  });

  it('returns a LocatorHealingError when the XML cannot be parsed', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(createElement());
    mocks.xmlParser.parse.mockImplementation(() => {
      throw new Error('malformed XML');
    });
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(LocatorHealingError);
    expect(result.unwrapErr().message).toMatch(/malformed XML/);
  });

  it('returns a LocatorHealingError when the repository update itself fails', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(createElement());
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.9);
    mocks.elementRepository.update.mockRejectedValue(new Error('disk write error'));
    const engine = createEngine(mocks);

    const result = await engine.heal(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/disk write error/);
  });

  it('honors a custom confidence threshold', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(createElement());
    mocks.xmlParser.parse.mockReturnValue([createElement({ elementId: 'candidate-a' })]);
    mocks.fingerprintEngine.elementSimilarity.mockReturnValue(0.5);
    const engine = new LocatorHealingEngine(
      mocks.elementRepository,
      mocks.xmlParser,
      mocks.fingerprintEngine,
      mocks.logger,
      undefined,
      { confidenceThreshold: 0.4 },
    );

    const result = await engine.heal(REQUEST);

    expect(result.unwrap().healed).toBe(true);
  });
});
