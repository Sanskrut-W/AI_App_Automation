import {
  IStepInterpretationPromptBuilder,
  StepInterpretationPromptInput,
} from './IStepInterpretationPromptBuilder';
import { Element } from '../../../core/entities/Element';

/** Builds the text prompt asking Gemini to interpret one manually-written QA test step against
 * the real elements on the current screen. Gemini-agnostic — just produces a prompt string. */
export class StepInterpretationPromptBuilder implements IStepInterpretationPromptBuilder {
  build(input: StepInterpretationPromptInput): string {
    const candidateDescriptions = input.candidateElements
      .map((candidate, index) => `${index}: ${this.describe(candidate)}`)
      .join('\n');

    return [
      'A QA engineer manually wrote a test step for a NATIVE ANDROID APP, in free text, without ' +
        'knowing which real UI elements exist. Your job is to interpret that step against the ' +
        "real elements on the app's current screen (listed below, each with an index) and a " +
        'screenshot of that same screen attached to this request.',
      '',
      `Step: "${input.stepDescription}"`,
      `Expected result (from the test case, describing what should happen after this step): "${input.expectedResult}"`,
      '',
      'Candidate elements on the CURRENT screen, each with an index:',
      candidateDescriptions.length > 0 ? candidateDescriptions : '(no elements found)',
      '',
      'Respond with ONLY a single JSON object (no markdown, no commentary, no code fences) matching exactly this shape:',
      '{',
      '  "applicable": boolean,',
      '  "reason": string | null,',
      '  "actions": [',
      '    {',
      '      "action": "click" | "type" | "scroll" | "wait",',
      '      "candidateIndex": number | null,',
      '      "fieldType": "literal" | "mobileNumber" | "password" | "none",',
      '      "literalValue": string | null,',
      '      "direction": "up" | "down" | null',
      '    }',
      '  ],',
      '  "expectedResultCheck": { "candidateIndex": number, "confidence": number } | null',
      '}',
      '',
      'Field guidance:',
      '- applicable: false ONLY when the step describes something that has no equivalent action ' +
        'in a native app at all — e.g. "enter the URL of https://..." (launching the app already ' +
        'happens automatically; there is no address bar). Set reason to explain why. If the step ' +
        'is app-appropriate but you simply cannot find a matching element, still set applicable ' +
        'to true and leave candidateIndex null for that action rather than guessing.',
      '- actions: an ORDERED list. Most steps produce exactly one action, but a step can describe ' +
        'more than one (e.g. "scroll to bottom and click login button" produces a scroll action ' +
        'THEN a click action). Use "wait" only if the step explicitly describes waiting.',
      '- candidateIndex: the index of the best-matching candidate element for a click/type action. ' +
        'null for scroll/wait, or when no candidate is a confident match.',
      '- fieldType: for a "type" action only. Use "mobileNumber" or "password" when the step refers ' +
        'to entering the mobile number or password of an account that ALREADY EXISTS (e.g. "enter ' +
        'mobile number (on which account exists)", "enter correct password") — the real value is ' +
        'substituted separately, do not invent one. Use "literal" only when the step text itself ' +
        'contains a concrete value to type, and put that exact value in literalValue. Use "none" ' +
        'for click/scroll/wait actions.',
      '- direction: "up" or "down" for a scroll action; null otherwise.',
      '- expectedResultCheck: only set this when one of the CANDIDATE elements listed above (i.e. ' +
        'already visible on the CURRENT screen, BEFORE the actions in this step run) would ' +
        'directly confirm the expected result. Most expected results describe a DIFFERENT screen ' +
        'reached only after the action completes, which you cannot see yet — in that common case, ' +
        'set this to null rather than guessing.',
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
