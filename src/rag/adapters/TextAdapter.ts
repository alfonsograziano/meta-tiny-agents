import fs from "fs";
import path from "path";
import type { FileAdapter } from "./FileAdapter.ts";

const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".jsonl",
  ".csv",
  ".yaml",
  ".yml",
];

export class TextAdapter implements FileAdapter {
  supports(filePath: string): boolean {
    return SUPPORTED_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
  }

  async load(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, "utf-8");
  }
}
