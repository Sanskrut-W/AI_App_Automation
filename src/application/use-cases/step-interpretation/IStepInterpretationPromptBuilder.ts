import { Element } from '../../../core/entities/Element';

export interface StepInterpretationPromptInput {
  stepDescription: string;
  expectedResult: string;
  candidateElements: Element[];
}

export interface IStepInterpretationPromptBuilder {
  build(input: StepInterpretationPromptInput): string;
}
