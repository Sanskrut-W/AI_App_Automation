import { Element } from '../../../core/entities/Element';

export interface IXmlElementParser {
  /** Parses a captured XML hierarchy dump into a flat list of Element records for the given screen. */
  parse(xml: string, screenId: string): Element[];
}
