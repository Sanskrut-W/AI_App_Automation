import { ElementProps } from '../../core/entities/Element';

/** elementId and screenId are identity (an element never moves to a different screen). */
export type ElementUpdate = Partial<Omit<ElementProps, 'elementId' | 'screenId'>>;
