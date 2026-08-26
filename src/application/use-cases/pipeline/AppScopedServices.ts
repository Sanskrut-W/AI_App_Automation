import { IScreenCrawler } from '../crawler/IScreenCrawler';
import { IScreenRepository } from '../../interfaces/repositories/IScreenRepository';
import { IMenuNavigationTestCaseGenerator } from '../test-generation/IMenuNavigationTestCaseGenerator';
import { ILoginTestCaseGenerator } from '../test-generation/ILoginTestCaseGenerator';
import { ISignUpTestCaseGenerator } from '../test-generation/ISignUpTestCaseGenerator';
import { IManualTestCaseGenerator } from '../test-generation/IManualTestCaseGenerator';
import { ITestCaseRepository } from '../../interfaces/repositories/ITestCaseRepository';
import { ITestExecutionEngine } from '../test-execution/ITestExecutionEngine';
import { IReportGenerator } from '../../interfaces/reporting/IReportGenerator';
import { NavigationGraph } from '../../dto/NavigationGraph';
import { TestModule } from '../../../shared/paths/TestModules';

/** A module's own test-case repository + execution engine, physically isolated from every other
 * module (see shared/paths/TestModules) — so e.g. logging in for real during the "login" module's
 * execution never contaminates the "hamburger-menu" module's stored suite or screen assumptions. */
export interface ModuleScopedServices {
  testCaseRepository: ITestCaseRepository;
  testExecutionEngine: ITestExecutionEngine;
}

/**
 * Everything the pipeline needs that must be freshly constructed per app package, because it
 * persists to that app's own artifacts/apps/<packageName>/ folder (see shared/paths/AppPaths).
 * Built once per pipeline run, as soon as the target app's package name is known — never shared
 * across two different apps.
 */
export interface AppScopedServices {
  screenCrawler: IScreenCrawler;
  screenRepository: IScreenRepository;
  menuNavigationTestCaseGenerator: IMenuNavigationTestCaseGenerator;
  loginTestCaseGenerator: ILoginTestCaseGenerator;
  signUpTestCaseGenerator: ISignUpTestCaseGenerator;
  manualTestCaseGenerator: IManualTestCaseGenerator;
  buildModuleServices: (module: TestModule) => ModuleScopedServices;
  reportGenerator: IReportGenerator;
  /** Loads this app's persisted navigation graph (written by the crawler) — null if it hasn't
   * been crawled yet, or the file is missing/malformed. Used by manual test case import, which
   * relies entirely on data a prior crawl already captured. */
  loadNavigationGraph: () => Promise<NavigationGraph | null>;
}

export type AppScopedServicesFactory = (packageName: string) => AppScopedServices;
