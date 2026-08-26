import { promises as fsp } from 'fs';
import path from 'path';
import { IFileWriter } from '../../../shared/fs/IFileWriter';

export class NodeFileWriter implements IFileWriter {
  async write(filePath: string, data: Buffer | string): Promise<void> {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, data);
  }
}
