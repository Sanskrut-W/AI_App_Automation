import { Screen } from '../../../core/entities/Screen';
import { ScreenUpdate } from '../../dto/ScreenUpdate';

/**
 * Storage contract for discovered screens. Deliberately storage-agnostic (plain async CRUD,
 * no filesystem-specific parameters) so a future database-backed implementation can replace
 * FileScreenRepository without any change to this interface or its callers.
 */
export interface IScreenRepository {
  add(screen: Screen): Promise<void>;
  update(screenId: string, updates: ScreenUpdate): Promise<Screen>;
  findById(screenId: string): Promise<Screen | null>;
  findAll(): Promise<Screen[]>;
  exists(screenId: string): Promise<boolean>;
  exportJson(): Promise<string>;
}
