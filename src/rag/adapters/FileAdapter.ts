export interface FileAdapter {
  supports(filePath: string): boolean;
  load(filePath: string): Promise<string>;
}
