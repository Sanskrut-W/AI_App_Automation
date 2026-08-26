import { Element } from '../../../core/entities/Element';

export interface ILocatorHealingPromptBuilder {
  build(target: Element, candidates: Element[]): string;
}
