export interface IFileWriter {
  write(filePath: string, data: Buffer | string): Promise<void>;
}
