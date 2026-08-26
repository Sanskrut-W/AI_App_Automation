import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeFileWriter } from '../../../../../src/infrastructure/persistence/file-system/NodeFileWriter';

describe('NodeFileWriter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfw-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes string data to a file, creating parent directories as needed', async () => {
    const writer = new NodeFileWriter();
    const filePath = path.join(tempDir, 'nested', 'dir', 'file.xml');

    await writer.write(filePath, '<hierarchy/>');

    expect(fs.readFileSync(filePath, 'utf-8')).toBe('<hierarchy/>');
  });

  it('writes Buffer data to a file', async () => {
    const writer = new NodeFileWriter();
    const filePath = path.join(tempDir, 'screenshot.png');
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    await writer.write(filePath, data);

    expect(fs.readFileSync(filePath)).toEqual(data);
  });

  it('overwrites an existing file', async () => {
    const writer = new NodeFileWriter();
    const filePath = path.join(tempDir, 'file.txt');

    await writer.write(filePath, 'first');
    await writer.write(filePath, 'second');

    expect(fs.readFileSync(filePath, 'utf-8')).toBe('second');
  });
});
