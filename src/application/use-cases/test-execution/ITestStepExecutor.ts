import { TestStep } from '../../../core/value-objects/TestStep';
import { StepResult } from '../../dto/StepResult';

export interface ITestStepExecutor {
  execute(step: TestStep): Promise<StepResult>;
}
