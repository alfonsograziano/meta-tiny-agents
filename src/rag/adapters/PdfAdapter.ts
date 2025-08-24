import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import type { FileAdapter } from "./FileAdapter.ts";

export class PdfAdapter implements FileAdapter {
  supports(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === ".pdf";
  }

  async load(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
}
