import { createHash } from 'crypto';
import path from 'path';
import { Screen } from '../../../core/entities/Screen';
import { Element } from '../../../core/entities/Element';
import { ElementLocator } from '../../../core/value-objects/ElementLocator';
import { CrawlError } from '../../../core/errors/CrawlError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IFileReader } from '../../../shared/fs/IFileReader';
import { IFileWriter } from '../../../shared/fs/IFileWriter';
import { IAppiumDriver } from '../../interfaces/drivers/IAppiumDriver';
import { IInteractionDriver } from '../../interfaces/drivers/IInteractionDriver';
import { IScreenRepository } from '../../interfaces/repositories/IScreenRepository';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { IXmlElementParser } from '../../interfaces/xml/IXmlElementParser';
import { CrawlRequest } from '../../dto/CrawlRequest';
import { CrawlSummary } from '../../dto/CrawlSummary';
import { NavigationGraph } from '../../dto/NavigationGraph';
import { ScreenCaptureResult } from '../../dto/ScreenCaptureResult';
import { IScreenCaptureService } from '../capture/IScreenCaptureService';
import { isAuthElement } from '../../../shared/text/isAuthElement';
import { isCloseButtonElement } from '../../../shared/text/isCloseButtonElement';
import { isDangerousActionElement } from '../../../shared/text/isDangerousActionElement';
import { isLoginTriggerElement } from '../../../shared/text/isLoginTriggerElement';
import { isSignUpTriggerElement } from '../../../shared/text/isSignUpTriggerElement';
import { IScreenCrawler } from './IScreenCrawler';

export interface ScreenCrawlerOptions {
  /** Safety net against infinite loops: max DFS recursion depth. */
  maxDepth?: number;
  /** Safety net against infinite loops: max distinct screens to discover before stopping. */
  maxScreens?: number;
  /** Where the navigation graph JSON artifact is written. */
  navigationGraphPath?: string;
  /** Overridable so tests don't pay real wall-clock delays for settle waits. */
  sleepFn?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_DEPTH = 20;
const DEFAULT_MAX_SCREENS = 100;
const DEFAULT_GRAPH_PATH = path.resolve(process.cwd(), 'artifacts', 'navigation-graph.json');
/** Safety net against a screen whose "close" button re-opens another overlay (e.g. a chained promo). */
const MAX_DISMISS_ATTEMPTS = 3;
/** Unlike a native screen transition, a WebView-hosted sign-up form can still be mid-navigation
 * (loading over the previous screen) well after the tap that opened it returns — observed
 * directly on the real Betway ZA app, where an immediate capture caught the old login screen
 * still fading out underneath the new page. Re-captures until the signature stops changing
 * between two consecutive attempts, up to this many tries, before giving up and using whatever
 * was last captured. */
const SIGN_UP_FORM_SETTLE_MAX_ATTEMPTS = 5;
const SIGN_UP_FORM_SETTLE_INTERVAL_MS = 1000;
/**
 * Proven necessary live against Betway ZA: the main exploration loop used to capture immediately
 * after every tap, with no settle time at all. Tapping the hamburger trigger caught the drawer
 * mid-slide-in — before its real content (Log Out, My Account, etc.) had rendered — so the
 * "opened menu" screen persisted was actually still just the screen underneath it. Every
 * "hamburger menu" test case later generated from that data ended up testing the wrong screen
 * entirely. A short, fixed pause (native UI animations settle well under a second — this doesn't
 * need SIGN_UP_FORM_SETTLE's slower "recapture until stable" treatment, which exists for a
 * WebView page load) before every post-tap capture closes that race for any quick transition,
 * not just this one.
 */
const POST_TAP_SETTLE_MS = 500;

/**
 * Depth-first autonomous crawler: launch -> capture -> extract clickable elements -> tap first
 * unvisited one -> capture -> (recurse or back) -> continue -> stop when no new screens remain.
 */
export class ScreenCrawler implements IScreenCrawler {
  private readonly maxDepth: number;
  private readonly maxScreens: number;
  private readonly navigationGraphPath: string;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(
    private readonly appiumDriver: IAppiumDriver,
    private readonly interactionDriver: IInteractionDriver,
    private readonly captureService: IScreenCaptureService,
    private readonly xmlParser: IXmlElementParser,
    private readonly screenRepository: IScreenRepository,
    private readonly elementRepository: IElementRepository,
    private readonly fileReader: IFileReader,
    private readonly fileWriter: IFileWriter,
    private readonly logger: ILogger,
    options: ScreenCrawlerOptions = {},
  ) {
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.maxScreens = options.maxScreens ?? DEFAULT_MAX_SCREENS;
    this.navigationGraphPath = options.navigationGraphPath ?? DEFAULT_GRAPH_PATH;
    this.sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async crawl(request: CrawlRequest): Promise<Result<CrawlSummary, CrawlError>> {
    const visitedElementIds: string[] = [];
    const graph: NavigationGraph = { rootScreenId: '', screenIds: [], edges: [] };
    const screenCount = { value: 0 };
    // Peeked at most once per crawl: captures the login form's fields (mobile/password inputs,
    // submit button) for the login test-case flow, without ever actually submitting it.
    const loginPeek = { done: false };
    // Peeked at most once per crawl (shared between the direct home-screen "Sign Up" button and
    // the nested link exposed on the login form, whichever is found first) — see exploreScreen and
    // peekLoginForm. The home screen's own direct button is checked first and is strongly
    // preferred: it's the real registration entry point end users tap, while the nested link is
    // only a fallback for apps where no direct button is found.
    const signUpPeek = { done: false };

    try {
      // Seeding from prior runs lets a repeat crawl of the same app recognize screens it has
      // already persisted — it won't re-add duplicate Screen/Element records, and won't
      // re-explore their subtree, but it still walks through them to find genuinely new ones.
      const knownScreens = await this.loadKnownScreens();
      const visitedSignatures = new Set<string>(knownScreens.keys());

      await this.appiumDriver.createSession({
        deviceId: request.deviceId,
        appPackage: request.appPackage,
        appActivity: request.appActivity,
      });
      await this.appiumDriver.launchApp(request.appPackage);

      const rootCaptureResult = await this.captureService.captureScreen();
      if (rootCaptureResult.isErr()) {
        throw new Error(`Initial screen capture failed: ${rootCaptureResult.unwrapErr().message}`);
      }
      let rootCapture = rootCaptureResult.unwrap();
      const rootXml = await this.fileReader.read(rootCapture.xml);
      let rootElements = this.xmlParser.parse(rootXml, rootCapture.screenId);

      const rootDismissed = await this.dismissOverlays(rootCapture, rootElements);
      rootCapture = rootDismissed.capture;
      rootElements = rootDismissed.elements;

      const rootSignature = this.computeSignature(rootCapture, rootElements);
      graph.rootScreenId = knownScreens.get(rootSignature) ?? rootCapture.screenId;
      visitedSignatures.add(rootSignature);
      screenCount.value = 1;

      await this.exploreScreen(
        rootCapture,
        rootElements,
        null,
        [graph.rootScreenId],
        0,
        visitedSignatures,
        knownScreens,
        visitedElementIds,
        graph,
        screenCount,
        loginPeek,
        signUpPeek,
      );

      await this.saveNavigationGraph(graph);

      this.logger.info('Crawl complete', {
        screensDiscovered: screenCount.value,
        elementsVisited: visitedElementIds.length,
      });

      return Result.ok({
        rootScreenId: graph.rootScreenId,
        screensDiscovered: screenCount.value,
        visitedElementIds,
        navigationGraph: graph,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Crawl failed', error instanceof Error ? error : undefined);
      return Result.err(new CrawlError(`Crawl failed: ${message}`));
    } finally {
      try {
        await this.appiumDriver.destroySession();
      } catch (error) {
        this.logger.warn('Ignoring error while destroying session after crawl', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async exploreScreen(
    capture: ScreenCaptureResult,
    elements: Element[],
    parentScreenId: string | null,
    navigationPath: string[],
    depth: number,
    visitedSignatures: Set<string>,
    knownScreens: Map<string, string>,
    visitedElementIds: string[],
    graph: NavigationGraph,
    screenCount: { value: number },
    loginPeek: { done: boolean },
    signUpPeek: { done: boolean },
  ): Promise<void> {
    const currentSignature = this.computeSignature(capture, elements);
    const existingScreenId = knownScreens.get(currentSignature);
    const screenId = existingScreenId ?? capture.screenId;
    // Keep knownScreens in sync with screens discovered THIS run too (not just seeded from a
    // prior run) — otherwise a second, different path reaching this same signature later in the
    // same crawl would mint an orphan screenId for its graph edge: one that was never persisted,
    // since exploreScreen() is only ever called (and only ever persists) for the FIRST encounter.
    knownScreens.set(currentSignature, screenId);

    if (existingScreenId) {
      this.logger.debug('Screen already known from a prior run, skipping duplicate persistence', {
        screenId: existingScreenId,
      });
    } else {
      const screen = new Screen({
        screenId: capture.screenId,
        screenName: capture.activityName,
        screenshotPath: capture.screenshot,
        xmlPath: capture.xml,
        packageName: capture.packageName,
        activityName: capture.activityName,
        parentScreenId,
        navigationPath,
        discoveredAt: capture.timestamp,
        structuralHash: currentSignature,
      });
      await this.screenRepository.add(screen);
      for (const element of elements) {
        await this.elementRepository.add(element);
      }
    }
    graph.screenIds.push(screenId);

    // Deliberately checked BEFORE the maxDepth/maxScreens safety limit below: the peek is a
    // distinct, one-time, tightly-controlled side quest (tap exactly one recognized trigger,
    // capture, back out — never explore further), not part of normal exploration, so it shouldn't
    // be at the mercy of exploration limits tuned for the (much less constrained) main tap loop.
    //
    // Checked BEFORE the login peek below: a direct "Sign Up" trigger reachable from THIS screen
    // (typically the home screen, which commonly exposes both a "Log In" and a "Sign Up" control
    // side by side) is the real registration entry point end users tap, and is strongly preferred
    // over the nested link peekLoginForm may find inside the login form itself.
    if (!signUpPeek.done) {
      const directSignUpTrigger = elements.find(
        (element) =>
          element.clickable && element.locators.length > 0 && isSignUpTriggerElement(element),
      );
      if (directSignUpTrigger) {
        signUpPeek.done = true;
        if (existingScreenId) {
          await this.elementRepository.add(directSignUpTrigger);
        }
        await this.peekSignUpForm(
          directSignUpTrigger,
          screenId,
          currentSignature,
          knownScreens,
          graph,
        );
      }
    }

    if (!loginPeek.done) {
      const loginTrigger = elements.find(
        (element) =>
          element.clickable && element.locators.length > 0 && isLoginTriggerElement(element),
      );
      if (loginTrigger) {
        loginPeek.done = true;
        if (existingScreenId) {
          // This screen was recognized as already known, so the "persist every element" loop
          // above was skipped entirely — meaning this freshly re-parsed trigger element (a brand
          // new elementId every run) was never written to disk. Without this, the graph edge
          // peekLoginForm is about to record would point at an element nothing can ever look up.
          await this.elementRepository.add(loginTrigger);
        }
        await this.peekLoginForm(
          loginTrigger,
          screenId,
          currentSignature,
          knownScreens,
          graph,
          signUpPeek,
        );
      }
    }

    if (depth >= this.maxDepth || screenCount.value >= this.maxScreens) {
      this.logger.warn('Crawl safety limit reached, not exploring further from this screen', {
        screenId,
        depth,
        screensDiscovered: screenCount.value,
      });
      return;
    }

    const clickableElements = elements.filter(
      (element) =>
        element.clickable &&
        element.locators.length > 0 &&
        !isAuthElement(element) &&
        !isDangerousActionElement(element),
    );
    const skippedAuthElements = elements.filter(
      (element) => element.clickable && element.locators.length > 0 && isAuthElement(element),
    );
    if (skippedAuthElements.length > 0) {
      this.logger.debug('Skipping login/sign-up elements during crawl', {
        screenId,
        count: skippedAuthElements.length,
      });
    }
    const skippedDangerousElements = elements.filter(
      (element) =>
        element.clickable && element.locators.length > 0 && isDangerousActionElement(element),
    );
    if (skippedDangerousElements.length > 0) {
      this.logger.debug('Skipping exit/logout-style elements during crawl', {
        screenId,
        count: skippedDangerousElements.length,
      });
    }

    for (const element of clickableElements) {
      if (screenCount.value >= this.maxScreens) {
        this.logger.warn('Max screens reached mid-exploration, stopping', { screenId });
        break;
      }

      const tapped = await this.tapElement(element);
      if (!tapped) {
        this.logger.warn('Failed to tap element via any locator candidate, skipping it', {
          elementId: element.elementId,
          className: element.className,
        });
        continue;
      }
      visitedElementIds.push(element.elementId);

      await this.sleep(POST_TAP_SETTLE_MS);
      const nextCaptureResult = await this.captureService.captureScreen();
      if (nextCaptureResult.isErr()) {
        this.logger.warn('Failed to capture after tap, attempting to recover by going back', {
          elementId: element.elementId,
        });
        await this.tryBack();
        continue;
      }
      let nextCapture = nextCaptureResult.unwrap();
      const nextXml = await this.fileReader.read(nextCapture.xml);
      let nextElements = this.xmlParser.parse(nextXml, nextCapture.screenId);

      const nextDismissed = await this.dismissOverlays(nextCapture, nextElements);
      nextCapture = nextDismissed.capture;
      nextElements = nextDismissed.elements;

      const nextSignature = this.computeSignature(nextCapture, nextElements);

      if (nextSignature === currentSignature) {
        // Tap did not navigate anywhere (e.g. a toggle) — nothing new to explore, and we never left.
        continue;
      }

      const nextScreenId = knownScreens.get(nextSignature) ?? nextCapture.screenId;

      graph.edges.push({
        fromScreenId: screenId,
        toScreenId: nextScreenId,
        elementId: element.elementId,
      });

      if (visitedSignatures.has(nextSignature)) {
        // Reached an already-known screen (this run or a prior one) — do not re-explore its subtree.
        await this.backAndRecover(currentSignature);
        continue;
      }

      visitedSignatures.add(nextSignature);
      screenCount.value += 1;

      await this.exploreScreen(
        nextCapture,
        nextElements,
        screenId,
        [...navigationPath, nextScreenId],
        depth + 1,
        visitedSignatures,
        knownScreens,
        visitedElementIds,
        graph,
        screenCount,
        loginPeek,
        signUpPeek,
      );
      await this.backAndRecover(currentSignature);
    }
  }

  /**
   * Taps a recognized login trigger exactly once per crawl to capture the login form's fields
   * (mobile/password inputs, submit button) — persisting that screen like any other, so the
   * login test-case flow has real field data to build from — then backs out immediately without
   * exploring its clickable elements at all. The form is never filled in or submitted here.
   *
   * If the login form itself exposes a recognized sign-up trigger (a "Don't have an account? Sign
   * Up" link is a common pattern), that screen is peeked too, nested one level deeper, before
   * backing all the way out — see peekSignUpForm.
   */
  private async peekLoginForm(
    trigger: Element,
    fromScreenId: string,
    fromSignature: string,
    knownScreens: Map<string, string>,
    graph: NavigationGraph,
    signUpPeek: { done: boolean },
  ): Promise<void> {
    const tapped = await this.tapElement(trigger);
    if (!tapped) {
      this.logger.warn('Failed to tap the login trigger while peeking at the login form', {
        elementId: trigger.elementId,
      });
      return;
    }

    const captureResult = await this.captureService.captureScreen();
    if (captureResult.isErr()) {
      this.logger.warn('Failed to capture the login form while peeking', {
        reason: captureResult.unwrapErr().message,
      });
      await this.backAndRecover(fromSignature);
      return;
    }

    const capture = captureResult.unwrap();
    const xml = await this.fileReader.read(capture.xml);
    const elements = this.xmlParser.parse(xml, capture.screenId);
    const signature = this.computeSignature(capture, elements);
    const existingScreenId = knownScreens.get(signature);
    const screenId = existingScreenId ?? capture.screenId;
    knownScreens.set(signature, screenId);

    if (!existingScreenId) {
      const screen = new Screen({
        screenId: capture.screenId,
        screenName: capture.activityName,
        screenshotPath: capture.screenshot,
        xmlPath: capture.xml,
        packageName: capture.packageName,
        activityName: capture.activityName,
        parentScreenId: fromScreenId,
        navigationPath: [fromScreenId, capture.screenId],
        discoveredAt: capture.timestamp,
        structuralHash: signature,
      });
      await this.screenRepository.add(screen);
      for (const element of elements) {
        await this.elementRepository.add(element);
      }
    }

    graph.edges.push({ fromScreenId, toScreenId: screenId, elementId: trigger.elementId });

    this.logger.info('Peeked at the login form (captured only, not submitted)', {
      screenId,
      elementId: trigger.elementId,
    });

    if (!signUpPeek.done) {
      const signUpTrigger = elements.find(
        (element) =>
          element.clickable && element.locators.length > 0 && isSignUpTriggerElement(element),
      );
      if (signUpTrigger) {
        signUpPeek.done = true;
        if (existingScreenId) {
          // Same reasoning as the login trigger's own persistence guard in exploreScreen(): this
          // screen being already-known meant its elements were never persisted this run, so this
          // freshly re-parsed trigger needs to be written to disk explicitly before it's referenced
          // by a graph edge.
          await this.elementRepository.add(signUpTrigger);
        }
        await this.peekSignUpForm(signUpTrigger, screenId, signature, knownScreens, graph);
      }
    }

    await this.backAndRecover(fromSignature);
  }

  /**
   * Same "peek once, capture, never fill or submit" approach as peekLoginForm, but for the
   * sign-up form reached from within the login screen. Persists the screen and its elements, then
   * backs out to the login screen it came from (peekLoginForm backs out the rest of the way).
   */
  private async peekSignUpForm(
    trigger: Element,
    fromScreenId: string,
    fromSignature: string,
    knownScreens: Map<string, string>,
    graph: NavigationGraph,
  ): Promise<void> {
    const tapped = await this.tapElement(trigger);
    if (!tapped) {
      this.logger.warn('Failed to tap the sign-up trigger while peeking at the sign-up form', {
        elementId: trigger.elementId,
      });
      return;
    }

    const settled = await this.waitForSignUpFormToSettle();
    if (!settled) {
      this.logger.warn('Failed to capture the sign-up form while peeking');
      await this.backAndRecover(fromSignature);
      return;
    }

    const { capture, elements, signature } = settled;
    const existingScreenId = knownScreens.get(signature);
    const screenId = existingScreenId ?? capture.screenId;
    knownScreens.set(signature, screenId);

    if (!existingScreenId) {
      const screen = new Screen({
        screenId: capture.screenId,
        screenName: capture.activityName,
        screenshotPath: capture.screenshot,
        xmlPath: capture.xml,
        packageName: capture.packageName,
        activityName: capture.activityName,
        parentScreenId: fromScreenId,
        navigationPath: [fromScreenId, capture.screenId],
        discoveredAt: capture.timestamp,
        structuralHash: signature,
      });
      await this.screenRepository.add(screen);
      for (const element of elements) {
        await this.elementRepository.add(element);
      }
    }

    graph.edges.push({ fromScreenId, toScreenId: screenId, elementId: trigger.elementId });

    this.logger.info('Peeked at the sign-up form (captured only, not submitted)', {
      screenId,
      elementId: trigger.elementId,
    });

    await this.backAndRecover(fromSignature);
  }

  /**
   * Re-captures until two consecutive captures produce the same structural signature (or
   * SIGN_UP_FORM_SETTLE_MAX_ATTEMPTS is reached, in which case the last capture is used anyway) —
   * see SIGN_UP_FORM_SETTLE_MAX_ATTEMPTS for why this exists. Returns null only if capture itself
   * fails outright.
   */
  private async waitForSignUpFormToSettle(): Promise<{
    capture: ScreenCaptureResult;
    elements: Element[];
    signature: string;
  } | null> {
    let previousSignature: string | null = null;

    for (let attempt = 0; attempt < SIGN_UP_FORM_SETTLE_MAX_ATTEMPTS; attempt++) {
      const captureResult = await this.captureService.captureScreen();
      if (captureResult.isErr()) {
        return null;
      }

      const capture = captureResult.unwrap();
      const xml = await this.fileReader.read(capture.xml);
      const elements = this.xmlParser.parse(xml, capture.screenId);
      const signature = this.computeSignature(capture, elements);

      if (signature === previousSignature) {
        return { capture, elements, signature };
      }
      if (attempt === SIGN_UP_FORM_SETTLE_MAX_ATTEMPTS - 1) {
        this.logger.debug(
          'Sign-up form did not settle within the retry budget, using last capture',
          {
            attempts: SIGN_UP_FORM_SETTLE_MAX_ATTEMPTS,
          },
        );
        return { capture, elements, signature };
      }

      previousSignature = signature;
      await this.sleep(SIGN_UP_FORM_SETTLE_INTERVAL_MS);
    }

    // Unreachable — the loop always returns on its last iteration — but keeps TypeScript happy.
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return this.sleepFn(ms);
  }

  /**
   * Repeatedly taps a recognized "close"-style button (ad/promo/dialog dismiss control) and
   * recaptures, so a screen the crawler would otherwise get stuck on is transparently dismissed
   * before it's treated as real app content. Bounded by MAX_DISMISS_ATTEMPTS in case dismissing
   * one overlay reveals another.
   */
  private async dismissOverlays(
    capture: ScreenCaptureResult,
    elements: Element[],
  ): Promise<{ capture: ScreenCaptureResult; elements: Element[] }> {
    let currentCapture = capture;
    let currentElements = elements;

    for (let attempt = 0; attempt < MAX_DISMISS_ATTEMPTS; attempt++) {
      const closeButton = this.findCloseButton(currentElements);
      if (!closeButton) {
        break;
      }

      this.logger.debug('Recognized an overlay close button, dismissing it', {
        elementId: closeButton.elementId,
        attempt: attempt + 1,
      });

      const tapped = await this.tapElement(closeButton);
      if (!tapped) {
        this.logger.warn(
          'Failed to tap overlay close button via any locator candidate, leaving it in place',
        );
        break;
      }

      const captureResult = await this.captureService.captureScreen();
      if (captureResult.isErr()) {
        this.logger.warn('Failed to capture screen after dismissing overlay', {
          reason: captureResult.unwrapErr().message,
        });
        break;
      }

      currentCapture = captureResult.unwrap();
      const xml = await this.fileReader.read(currentCapture.xml);
      currentElements = this.xmlParser.parse(xml, currentCapture.screenId);
    }

    return { capture: currentCapture, elements: currentElements };
  }

  private findCloseButton(elements: Element[]): Element | null {
    return (
      elements.find(
        (element) =>
          element.clickable && element.locators.length > 0 && isCloseButtonElement(element),
      ) ?? null
    );
  }

  private async loadKnownScreens(): Promise<Map<string, string>> {
    const existingScreens = await this.screenRepository.findAll();
    const knownScreens = new Map<string, string>();
    for (const screen of existingScreens) {
      if (screen.structuralHash) {
        knownScreens.set(screen.structuralHash, screen.screenId);
      }
    }
    return knownScreens;
  }

  private async tryBack(): Promise<void> {
    try {
      await this.interactionDriver.back();
    } catch (error) {
      this.logger.warn('back() failed during crawl', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Presses back, then verifies it actually returned to the expected screen instead of blindly
   * assuming so. Pressing back with no more back-stack left (e.g. from the app's true home
   * screen) commonly triggers an "Exit app?" confirmation dialog rather than navigating anywhere
   * — if left unhandled, the crawler would go on tapping its next sibling element's stale locator
   * against this unexpected dialog instead of the screen it thinks it's on. The same applies to a
   * WebView-heavy popup that back() only partially closes (proven live: a single back press left
   * Betway ZA's Sign-Up popup open, and the crawler then tapped the home screen's cached Login
   * button on top of it, stacking a second popup and hanging the accessibility service) — so each
   * dismiss attempt is re-verified by re-capturing, retrying up to MAX_DISMISS_ATTEMPTS times
   * instead of assuming one recognized close/cancel tap is enough.
   */
  private async backAndRecover(expectedSignature: string): Promise<void> {
    await this.tryBack();

    let captureResult = await this.captureService.captureScreen();
    if (captureResult.isErr()) {
      return;
    }
    let capture = captureResult.unwrap();
    let xml = await this.fileReader.read(capture.xml);
    let elements = this.xmlParser.parse(xml, capture.screenId);

    for (let attempt = 0; attempt < MAX_DISMISS_ATTEMPTS; attempt++) {
      if (this.computeSignature(capture, elements) === expectedSignature) {
        return;
      }

      const dismissButton = elements.find(
        (element) =>
          element.clickable &&
          element.locators.length > 0 &&
          this.isBackRecoveryDismissElement(element),
      );
      if (!dismissButton) {
        this.logger.warn('back() landed on an unexpected screen with no recognizable way back', {
          expectedSignature,
        });
        return;
      }

      this.logger.warn(
        'back() triggered an unexpected screen (e.g. an exit-app confirmation dialog, or a popup ' +
          'it only partially closed); dismissing it',
        { elementId: dismissButton.elementId, attempt: attempt + 1 },
      );
      const tapped = await this.tapElement(dismissButton);
      if (!tapped) {
        this.logger.warn(
          'Failed to tap the recovery dismiss button via any locator candidate, giving up',
          { elementId: dismissButton.elementId },
        );
        return;
      }

      captureResult = await this.captureService.captureScreen();
      if (captureResult.isErr()) {
        return;
      }
      capture = captureResult.unwrap();
      xml = await this.fileReader.read(capture.xml);
      elements = this.xmlParser.parse(xml, capture.screenId);
    }

    if (this.computeSignature(capture, elements) !== expectedSignature) {
      this.logger.warn('Exhausted recovery attempts without returning to the expected screen', {
        expectedSignature,
      });
    }
  }

  /** Broader than isCloseButtonElement (adds "cancel") — safe to use only here, where we already
   * know the current screen doesn't match what back() was expected to return to. */
  private isBackRecoveryDismissElement(element: Element): boolean {
    if (isCloseButtonElement(element)) {
      return true;
    }
    const haystack = [
      element.text,
      element.contentDescription,
      element.resourceId,
      element.accessibilityId,
    ].join(' ');
    return /cancel/i.test(haystack);
  }

  /**
   * Tries every locator candidate for this element, in priority order, stopping at the first
   * successful tap. The lowest-priority candidate is always a bounds-center coordinate tap (see
   * XmlElementParser), which bypasses accessibility-tree/resource-id lookup entirely — a reliable
   * last resort when an app's live element lookup is flaky (e.g. WebView-heavy screens where the
   * native accessibility tree can be transiently inconsistent).
   */
  private async tapElement(element: Element): Promise<boolean> {
    for (const candidate of element.locators) {
      const locator: ElementLocator = { strategy: candidate.strategy, value: candidate.value };
      try {
        await this.interactionDriver.tap(locator);
        return true;
      } catch (error) {
        this.logger.debug('Locator candidate failed to tap, trying the next one', {
          elementId: element.elementId,
          strategy: candidate.strategy,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return false;
  }

  private computeSignature(capture: ScreenCaptureResult, elements: Element[]): string {
    const elementSignature = elements
      .map(
        (element) =>
          `${element.className}|${element.resourceId}|${element.text}|${element.clickable}`,
      )
      .sort()
      .join(';');
    const raw = `${capture.packageName}|${capture.activityName}|${elementSignature}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  private async saveNavigationGraph(graph: NavigationGraph): Promise<void> {
    try {
      await this.fileWriter.write(this.navigationGraphPath, JSON.stringify(graph, null, 2));
    } catch (error) {
      this.logger.warn('Failed to save navigation graph artifact', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
