import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodeFileReader } from '../../../../../src/infrastructure/persistence/file-system/NodeFileReader';

describe('NodeFileReader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfr-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads the contents of a file as utf-8 text', async () => {
    const filePath = path.join(tempDir, 'hierarchy.xml');
    fs.writeFileSync(filePath, '<hierarchy><node/></hierarchy>');
    const reader = new NodeFileReader();

    const contents = await reader.read(filePath);

    expect(contents).toBe('<hierarchy><node/></hierarchy>');
  });

  it('rejects when the file does not exist', async () => {
    const reader = new NodeFileReader();

    await expect(reader.read(path.join(tempDir, 'missing.xml'))).rejects.toThrow();
  });

  it('reads the contents of a file as a raw Buffer', async () => {
    const filePath = path.join(tempDir, 'screenshot.png');
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    fs.writeFileSync(filePath, data);
    const reader = new NodeFileReader();

    const contents = await reader.readBinary(filePath);

    expect(contents).toEqual(data);
  });

  it('readBinary rejects when the file does not exist', async () => {
    const reader = new NodeFileReader();

    await expect(reader.readBinary(path.join(tempDir, 'missing.png'))).rejects.toThrow();
  });
});
