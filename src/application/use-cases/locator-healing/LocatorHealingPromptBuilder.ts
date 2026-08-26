import { Element } from '../../../core/entities/Element';
import { ILocatorHealingPromptBuilder } from './ILocatorHealingPromptBuilder';

/** Builds the text prompt asking Gemini to pick the best-matching candidate element. Gemini-agnostic — just produces a prompt string. */
export class LocatorHealingPromptBuilder implements ILocatorHealingPromptBuilder {
  build(target: Element, candidates: Element[]): string {
    const candidateDescriptions = candidates
      .map((candidate, index) => `${index}: ${this.describe(candidate)}`)
      .join('\n');

    return [
      "A mobile test's stored locator for a UI element no longer resolves on the current screen " +
        '— the element may have moved, or the screen may have changed slightly. Deterministic ' +
        'structural matching against the current screen found nothing confident enough.',
      '',
      'The element we are looking for used to look like this:',
      this.describe(target),
      '',
      'Here are the candidate elements found on the current screen, each with an index:',
      candidateDescriptions,
      '',
      'Respond with ONLY a single JSON object (no markdown, no commentary, no code fences) matching exactly this shape:',
      '{ "matchIndex": number | null }',
      '',
      'Set matchIndex to the index of the candidate that is almost certainly the same element as ' +
        'the one described above. If no candidate is a confident match, set matchIndex to null. ' +
        'Do not guess if unsure.',
    ].join('\n');
  }

  private describe(element: Element): string {
    return [
      `class=${element.className}`,
      `text="${element.text}"`,
      `resourceId=${element.resourceId}`,
      `accessibilityId=${element.accessibilityId}`,
      `clickable=${element.clickable}`,
      `bounds=[${element.bounds.left},${element.bounds.top}][${element.bounds.right},${element.bounds.bottom}]`,
    ].join(', ');
  }
}
