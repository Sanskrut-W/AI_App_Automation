import { TestCase } from '../../../core/entities/TestCase';
import { Element } from '../../../core/entities/Element';
import { ActionType } from '../../../core/enums/ActionType';
import { LocatorStrategy } from '../../../core/enums/LocatorStrategy';
import { TestPriority } from '../../../core/enums/TestPriority';
import { TestStep } from '../../../core/value-objects/TestStep';
import { ElementLocator } from '../../../core/value-objects/ElementLocator';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IIdGenerator } from '../../../shared/id/IIdGenerator';
import { isAuthElement } from '../../../shared/text/isAuthElement';
import { isDangerousActionElement } from '../../../shared/text/isDangerousActionElement';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { NavigationGraph, NavigationGraphEdge } from '../../dto/NavigationGraph';
import { MenuNavigationTestCaseRequest } from '../../dto/MenuNavigationTestCaseRequest';
import { IMenuNavigationTestCaseGenerator } from './IMenuNavigationTestCaseGenerator';

const MENU_TRIGGER_PATTERN =
  /hamburger|drawer|open\s*navigation|main\s*menu|nav(igation)?\s*menu|menu/i;
// An unmodified ActionBarDrawerToggle icon carries only the stock "Open"/"Close"
// content-description (no app-specific wording), so it needs a structural fallback check below.
const DRAWER_TOGGLE_DEFAULT_LABEL_PATTERN = /^(open|close)$/i;
const ICON_WIDGET_CLASS_PATTERN = /imagebutton|imageview/i;
/** Gives the trigger's tap/verify time to settle before the drawer's contents are checked. */
const MENU_OPEN_SETTLE_MS = 600;

/**
 * Deterministic, navigation-graph-driven alternative to the generic AI-analyzed generator: finds
 * the screen reached by tapping the app's hamburger/nav-drawer trigger during crawling, and
 * generates one "tap this menu item, verify the correct screen loads" test case per item on it —
 * skipping login/sign-up entry points so execution never needs real credentials.
 */
export class MenuNavigationTestCaseGenerator implements IMenuNavigationTestCaseGenerator {
  constructor(
    private readonly elementRepository: IElementRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger,
  ) {}

  async generate(
    request: MenuNavigationTestCaseRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>> {
    try {
      const menuTrigger = await this.findMenuTrigger(request.navigationGraph);
      if (!menuTrigger) {
        this.logger.warn(
          'No hamburger/navigation menu was found in this crawl, skipping test case generation.',
        );
        return Result.ok([]);
      }
      const { edge: menuEdge, element: triggerElement } = menuTrigger;

      const menuItems = await this.elementRepository.search({ screenId: menuEdge.toScreenId });
      const testableItems = menuItems.filter(
        (element) =>
          element.clickable &&
          element.locators.length > 0 &&
          !isAuthElement(element) &&
          !isDangerousActionElement(element),
      );

      const testCases: TestCase[] = [];
      for (const item of testableItems) {
        const destinationEdge = request.navigationGraph.edges.find(
          (edge) => edge.elementId === item.elementId,
        );
        const anchor = destinationEdge
          ? await this.findAnchorElement(destinationEdge.toScreenId)
          : null;

        testCases.push(this.buildTestCase(request, triggerElement, item, anchor));
      }

      this.logger.info('Hamburger menu test case generation complete', {
        menuScreenId: menuEdge.toScreenId,
        menuItemsFound: menuItems.length,
        testCasesGenerated: testCases.length,
      });
      return Result.ok(testCases);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new TestCaseGenerationError(`Failed to generate hamburger menu test cases: ${message}`),
      );
    }
  }

  private async findMenuTrigger(
    graph: NavigationGraph,
  ): Promise<{ edge: NavigationGraphEdge; element: Element } | null> {
    for (const edge of graph.edges) {
      const element = await this.elementRepository.findById(edge.elementId);
      if (element && this.looksLikeMenuTrigger(element)) {
        return { edge, element };
      }
    }
    return null;
  }

  private looksLikeMenuTrigger(element: Element): boolean {
    const haystack = [
      element.text,
      element.contentDescription,
      element.accessibilityId,
      element.resourceId,
    ].join(' ');
    if (MENU_TRIGGER_PATTERN.test(haystack)) {
      return true;
    }

    // Structural fallback for an unmodified ActionBarDrawerToggle: DrawerLayout wraps the WHOLE
    // screen (including any WebView main content), so "nested inside a DrawerLayout" alone matches
    // almost every clickable element on the screen — nowhere near precise enough on its own. Only
    // treat it as the toggle when it ALSO (a) carries exactly the stock "Open"/"Close" label. (b)
    // is a native icon widget (ImageButton/ImageView) — WebView content never renders as one, and
    // (c) is not itself nested inside a WebView, which would mean it's page content, not app chrome.
    const label = (element.contentDescription || element.accessibilityId).trim();
    if (!DRAWER_TOGGLE_DEFAULT_LABEL_PATTERN.test(label)) {
      return false;
    }
    if (!ICON_WIDGET_CLASS_PATTERN.test(element.className)) {
      return false;
    }
    const xpathLocator = element.locators.find(
      (locator) => locator.strategy === LocatorStrategy.XPATH_CLASS_INDEX,
    );
    const xpath = xpathLocator?.value ?? '';
    return /drawerlayout/i.test(xpath) && !/webview/i.test(xpath);
  }

  private async findAnchorElement(screenId: string): Promise<Element | null> {
    const elements = await this.elementRepository.search({ screenId });
    return elements.find((element) => element.locators.length > 0) ?? null;
  }

  private buildTestCase(
    request: MenuNavigationTestCaseRequest,
    triggerElement: Element,
    item: Element,
    anchor: Element | null,
  ): TestCase {
    const label = item.text || item.contentDescription || 'menu item';
    const locator = this.toLocator(item);
    const triggerLocator = this.toLocator(triggerElement);

    // The menu is closed on a fresh launch, so the menu item isn't on screen yet — the trigger
    // has to be opened first, or execution would fail verifying/tapping an item that isn't there.
    const steps: TestStep[] = [
      {
        stepNumber: 1,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: triggerLocator,
        elementId: triggerElement.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'The hamburger menu button is present.',
      },
      {
        stepNumber: 2,
        action: ActionType.CLICK,
        targetLocator: triggerLocator,
        elementId: triggerElement.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Tapping the hamburger menu button opens the navigation menu.',
      },
      {
        // Lets the drawer's slide-in animation settle before its contents are checked — tapping
        // or verifying mid-animation can land on the wrong, still-moving target.
        stepNumber: 3,
        action: ActionType.WAIT,
        targetLocator: null,
        elementId: null,
        value: null,
        direction: null,
        durationMs: MENU_OPEN_SETTLE_MS,
        expectedResult: 'The navigation menu finishes opening.',
      },
      {
        stepNumber: 4,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: locator,
        elementId: item.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: `"${label}" is present in the opened hamburger menu.`,
      },
      {
        stepNumber: 5,
        action: ActionType.CLICK,
        targetLocator: locator,
        elementId: item.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: `Tapping "${label}" navigates away from the menu.`,
      },
    ];

    if (anchor) {
      steps.push({
        stepNumber: 6,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: this.toLocator(anchor),
        elementId: anchor.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: `The correct screen loads after tapping "${label}".`,
      });
    }

    return new TestCase({
      testCaseId: this.idGenerator.generate(),
      screenId: item.screenId,
      title: `Hamburger menu: ${label}`,
      description: `Verifies that tapping "${label}" in the hamburger menu opens the correct screen.`,
      steps,
      priority: TestPriority.MEDIUM,
      tags: ['hamburger-menu'],
      appVersionName: request.appVersionName,
      appVersionCode: request.appVersionCode,
    });
  }

  private toLocator(element: Element): ElementLocator {
    const [best] = element.locators;
    return { strategy: best.strategy, value: best.value };
  }
}
