import { promises as fsp } from 'fs';
import { IFileReader } from '../../../shared/fs/IFileReader';

export class NodeFileReader implements IFileReader {
  async read(filePath: string): Promise<string> {
    return fsp.readFile(filePath, 'utf-8');
  }

  async readBinary(filePath: string): Promise<Buffer> {
    return fsp.readFile(filePath);
  }
}
