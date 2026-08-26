import { randomUUID } from 'crypto';
import { IIdGenerator } from '../../shared/id/IIdGenerator';

export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
