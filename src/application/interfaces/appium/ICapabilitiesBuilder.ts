import { CreateSessionOptions } from '../../dto/CreateSessionOptions';

/** Centralizes how desired capabilities are shaped for a given platform driver. */
export interface ICapabilitiesBuilder {
  build(options: CreateSessionOptions): Record<string, unknown>;
}
