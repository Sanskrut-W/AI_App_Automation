import { MenuNavigationTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/MenuNavigationTestCaseGenerator';
import { IElementRepository } from '../../../../../src/application/interfaces/repositories/IElementRepository';
import { IIdGenerator } from '../../../../../src/shared/id/IIdGenerator';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { NavigationGraph } from '../../../../../src/application/dto/NavigationGraph';
import { createMockLogger } from '../../../support/createMockLogger';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'menu-screen',
    className: 'android.widget.TextView',
    text: 'Promotions',
    resourceId: 'com.example.app:id/promotions',
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
        value: 'com.example.app:id/promotions',
        priority: 1,
      },
    ],
    ...overrides,
  });
}

const APP_VERSION = { appVersionName: '1.0.0', appVersionCode: '1' };

const MENU_TRIGGER = createElement({
  elementId: 'hamburger-1',
  screenId: 'home-screen',
  className: 'android.widget.ImageButton',
  text: '',
  resourceId: 'com.example.app:id/btn_menu',
  contentDescription: 'Open navigation drawer',
});

function createGraph(overrides: Partial<NavigationGraph> = {}): NavigationGraph {
  return {
    rootScreenId: 'home-screen',
    screenIds: ['home-screen', 'menu-screen'],
    edges: [{ fromScreenId: 'home-screen', toScreenId: 'menu-screen', elementId: 'hamburger-1' }],
    ...overrides,
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
  const idGenerator: jest.Mocked<IIdGenerator> = {
    generate: jest.fn().mockReturnValue('test-case-1'),
  };
  const logger = createMockLogger();

  return { elementRepository, idGenerator, logger };
}

function createGenerator(mocks: ReturnType<typeof createMocks>) {
  return new MenuNavigationTestCaseGenerator(
    mocks.elementRepository,
    mocks.idGenerator,
    mocks.logger,
  );
}

describe('MenuNavigationTestCaseGenerator', () => {
  it('finds the hamburger menu edge, then generates an open-menu+verify+click test case per menu item', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(MENU_TRIGGER);
    const promotionsItem = createElement();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'menu-screen') return [promotionsItem];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);
    expect(mocks.elementRepository.search).toHaveBeenCalledWith({ screenId: 'menu-screen' });

    const testCase = testCases[0];
    expect(testCase.testCaseId).toBe('test-case-1');
    expect(testCase.title).toBe('Hamburger menu: Promotions');
    expect(testCase.tags).toEqual(['hamburger-menu']);
    expect(testCase.appVersionName).toBe('1.0.0');
    expect(testCase.appVersionCode).toBe('1');
    // The menu is closed on a fresh launch, so the trigger has to be opened first: verify+click
    // the hamburger button, wait for the drawer's slide-in animation to settle, then verify+click
    // the menu item itself.
    expect(testCase.steps).toHaveLength(5);
    expect(testCase.steps[0].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[0].elementId).toBe('hamburger-1');
    expect(testCase.steps[1].action).toBe(ActionType.CLICK);
    expect(testCase.steps[1].elementId).toBe('hamburger-1');
    expect(testCase.steps[2].action).toBe(ActionType.WAIT);
    expect(testCase.steps[3].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[3].elementId).toBe(promotionsItem.elementId);
    expect(testCase.steps[4].action).toBe(ActionType.CLICK);
    expect(testCase.steps[4].elementId).toBe(promotionsItem.elementId);
  });

  it('adds a trailing verify step anchored on the destination screen when the menu item has a known edge', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(MENU_TRIGGER);
    const promotionsItem = createElement();
    const anchorElement = createElement({
      elementId: 'anchor-1',
      screenId: 'promotions-screen',
      text: 'Promotions title',
      resourceId: 'com.example.app:id/promotions_title',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/promotions_title',
          priority: 1,
        },
      ],
    });
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'menu-screen') return [promotionsItem];
      if (screenId === 'promotions-screen') return [anchorElement];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({
      navigationGraph: createGraph({
        edges: [
          { fromScreenId: 'home-screen', toScreenId: 'menu-screen', elementId: 'hamburger-1' },
          {
            fromScreenId: 'menu-screen',
            toScreenId: 'promotions-screen',
            elementId: 'element-1',
          },
        ],
      }),
      ...APP_VERSION,
    });

    const testCase = result.unwrap()[0];
    expect(testCase.steps).toHaveLength(6);
    expect(testCase.steps[5].action).toBe(ActionType.VERIFY_ELEMENT_EXISTS);
    expect(testCase.steps[5].targetLocator).toEqual({
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/promotions_title',
    });
  });

  it('excludes login/sign-up items from the generated menu test cases', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(MENU_TRIGGER);
    const loginItem = createElement({
      elementId: 'element-2',
      text: 'Log In',
      resourceId: 'com.example.app:id/login',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
      ],
    });
    const promotionsItem = createElement();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'menu-screen') return [loginItem, promotionsItem];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);
    expect(testCases[0].title).toBe('Hamburger menu: Promotions');
  });

  it('excludes exit/logout-style items from the generated menu test cases', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(MENU_TRIGGER);
    const logOutItem = createElement({
      elementId: 'element-2',
      text: 'Log Out',
      resourceId: 'com.example.app:id/logout',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/logout', priority: 1 },
      ],
    });
    const promotionsItem = createElement();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'menu-screen') return [logOutItem, promotionsItem];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    const testCases = result.unwrap();
    expect(testCases).toHaveLength(1);
    expect(testCases[0].title).toBe('Hamburger menu: Promotions');
  });

  it('recognizes a DrawerLayout-nested toggle button as the menu trigger even with only a generic "Open" content-description', async () => {
    const mocks = createMocks();
    const genericDrawerToggle = createElement({
      elementId: 'hamburger-1',
      screenId: 'home-screen',
      className: 'android.widget.ImageButton',
      text: '',
      resourceId: '',
      contentDescription: 'Open',
      accessibilityId: 'Open',
      locators: [
        { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Open', priority: 2 },
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value:
            '/android.widget.FrameLayout[1]/androidx.drawerlayout.widget.DrawerLayout[1]/android.widget.ImageButton[1]',
          priority: 4,
        },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(genericDrawerToggle);
    const promotionsItem = createElement();
    mocks.elementRepository.search.mockImplementation(async ({ screenId }) => {
      if (screenId === 'menu-screen') return [promotionsItem];
      return [];
    });
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(mocks.elementRepository.search).toHaveBeenCalledWith({ screenId: 'menu-screen' });
  });

  it('does not mistake a WebView-content link merely nested inside the DrawerLayout for the menu trigger', async () => {
    // Regression test: DrawerLayout wraps the ENTIRE screen (including the main WebView content),
    // so "nested inside a DrawerLayout" alone matches almost any clickable element on the screen —
    // e.g. a "All Codes" promo link deep inside the app's WebView content, which is not a trigger.
    const mocks = createMocks();
    const webViewContentLink = createElement({
      elementId: 'element-9',
      className: 'android.view.View',
      text: '',
      resourceId: '',
      contentDescription: 'All Codes',
      accessibilityId: 'All Codes',
      locators: [
        { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'All Codes', priority: 2 },
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value:
            '/android.widget.FrameLayout[1]/androidx.drawerlayout.widget.DrawerLayout[1]/android.webkit.WebView[1]/android.webkit.WebView[1]/android.view.View[3]',
          priority: 4,
        },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(webViewContentLink);
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.elementRepository.search).not.toHaveBeenCalled();
  });

  it('does not treat a DrawerLayout-nested element as the trigger when its label is not exactly "Open"/"Close"', async () => {
    const mocks = createMocks();
    const otherToolbarIcon = createElement({
      elementId: 'element-9',
      className: 'android.widget.ImageButton',
      text: '',
      resourceId: '',
      contentDescription: 'Search',
      accessibilityId: 'Search',
      locators: [
        { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Search', priority: 2 },
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value:
            '/android.widget.FrameLayout[1]/androidx.drawerlayout.widget.DrawerLayout[1]/android.widget.ImageButton[1]',
          priority: 4,
        },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(otherToolbarIcon);
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.unwrap()).toEqual([]);
  });

  it('does not treat a DrawerLayout-nested element as the trigger when it is not a native icon widget', async () => {
    const mocks = createMocks();
    const genericViewLabeledOpen = createElement({
      elementId: 'element-9',
      className: 'android.view.View',
      text: '',
      resourceId: '',
      contentDescription: 'Open',
      accessibilityId: 'Open',
      locators: [
        { strategy: LocatorStrategy.ACCESSIBILITY_ID, value: 'Open', priority: 2 },
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value:
            '/android.widget.FrameLayout[1]/androidx.drawerlayout.widget.DrawerLayout[1]/android.view.View[1]',
          priority: 4,
        },
      ],
    });
    mocks.elementRepository.findById.mockResolvedValue(genericViewLabeledOpen);
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.unwrap()).toEqual([]);
  });

  it('returns an empty array (not an error) when no hamburger menu trigger is found', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockResolvedValue(
      createElement({ elementId: 'element-9', text: 'Continue' }),
    );
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual([]);
    expect(mocks.elementRepository.search).not.toHaveBeenCalled();
  });

  it('returns a TestCaseGenerationError when the element repository fails', async () => {
    const mocks = createMocks();
    mocks.elementRepository.findById.mockRejectedValue(new Error('disk read error'));
    const generator = createGenerator(mocks);

    const result = await generator.generate({ navigationGraph: createGraph(), ...APP_VERSION });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/disk read error/);
  });
});
