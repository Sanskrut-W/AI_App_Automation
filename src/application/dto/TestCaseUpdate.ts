import { TestCaseProps } from '../../core/entities/TestCase';

/** testCaseId and screenId are identity (a test case never moves to a different screen). */
export type TestCaseUpdate = Partial<Omit<TestCaseProps, 'testCaseId' | 'screenId'>>;
