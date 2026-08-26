import { Element } from '../../../core/entities/Element';
import { ElementUpdate } from '../../dto/ElementUpdate';
import { ElementSearchCriteria } from '../../dto/ElementSearchCriteria';

/**
 * Storage contract for extracted elements. Storage-agnostic (plain async CRUD + search, no
 * filesystem-specific parameters) so a future database-backed implementation can replace
 * FileElementRepository without any change to this interface or its callers.
 */
export interface IElementRepository {
  add(element: Element): Promise<void>;
  update(elementId: string, updates: ElementUpdate): Promise<Element>;
  findById(elementId: string): Promise<Element | null>;
  findAll(): Promise<Element[]>;
  search(criteria: ElementSearchCriteria): Promise<Element[]>;
  exists(elementId: string): Promise<boolean>;
  exportJson(): Promise<string>;
}
