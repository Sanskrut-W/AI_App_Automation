export interface IFileReader {
  read(filePath: string): Promise<string>;
  readBinary(filePath: string): Promise<Buffer>;
}
