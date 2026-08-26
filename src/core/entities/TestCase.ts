import { TestPriority } from '../enums/TestPriority';
import { TestStep } from '../value-objects/TestStep';

export interface TestCaseProps {
  testCaseId: string;
  screenId: string;
  title: string;
  description: string;
  steps: TestStep[];
  priority: TestPriority;
  tags: string[];
  /** The app build this test case was generated against (Application.versionName/versionCode), so a stale test case can be told apart from one generated for the current build. */
  appVersionName: string;
  appVersionCode: string;
  /** Optional explicit run order within a module (ascending, ties broken by the repository's
   * natural read order). Only set where ordering actually matters — e.g. a hand-authored suite
   * where a later test case depends on an earlier one's side effects (a logout test case that
   * must run after login test cases but before ones that assume a logged-out start state). Most
   * test cases have no sequence and simply run in whatever order the repository returns them. */
  sequence?: number;
}

export class TestCase {
  readonly testCaseId: string;
  readonly screenId: string;
  readonly title: string;
  readonly description: string;
  readonly steps: TestStep[];
  readonly priority: TestPriority;
  readonly tags: string[];
  readonly appVersionName: string;
  readonly appVersionCode: string;
  readonly sequence?: number;

  constructor(props: TestCaseProps) {
    if (!props.testCaseId) {
      throw new Error('TestCase requires a non-empty testCaseId.');
    }
    if (!props.screenId) {
      throw new Error('TestCase requires a non-empty screenId.');
    }

    this.testCaseId = props.testCaseId;
    this.screenId = props.screenId;
    this.title = props.title;
    this.description = props.description;
    this.steps = props.steps;
    this.priority = props.priority;
    this.tags = props.tags;
    this.appVersionName = props.appVersionName;
    this.appVersionCode = props.appVersionCode;
    this.sequence = props.sequence;
  }
}
