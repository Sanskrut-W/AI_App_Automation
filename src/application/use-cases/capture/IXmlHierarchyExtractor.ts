export interface IXmlHierarchyExtractor {
  capture(): Promise<string>;
  save(xml: string, filePath: string): Promise<string>;
}
