import { ScreenProps } from '../../core/entities/Screen';

/** screenId is identity (never updated) and discoveredAt records first discovery (immutable once set). */
export type ScreenUpdate = Partial<Omit<ScreenProps, 'screenId' | 'discoveredAt'>>;
