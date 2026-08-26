export interface IScreenshotManager {
  capture(): Promise<Buffer>;
  save(screenshot: Buffer, filePath: string): Promise<string>;
}
