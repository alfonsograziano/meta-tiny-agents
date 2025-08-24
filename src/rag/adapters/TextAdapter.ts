import fs from "fs";
import path from "path";
import type { FileAdapter } from "./FileAdapter.ts";

export class TextAdapter implements FileAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".txt";
  }

  async load(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, "utf-8");
  }
}
