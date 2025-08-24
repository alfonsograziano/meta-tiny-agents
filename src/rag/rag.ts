import { Pool } from "pg";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import type { FileAdapter } from "./adapters/FileAdapter.ts";
import { TextAdapter, PdfAdapter } from "./adapters/index.ts";

type Env = {
  OPENAI_API_KEY?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
  DOCS_DIR?: string;
};

export class RAGIndexer {
  private pool: Pool;
  private openai: OpenAI;
  private docsDir: string;
  private readonly CHUNK_SIZE = 500;
  private adapters: FileAdapter[];

  constructor(env: Env = process.env as Env) {
    if (!env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    if (!env.DOCS_DIR) throw new Error("Missing DOCS_DIR");

    this.pool = new Pool({
      host: env.PGHOST ?? "localhost",
      port: Number(env.PGPORT ?? 5432),
      user: env.PGUSER ?? "postgres",
      password: env.PGPASSWORD ?? "postgres",
      database: env.PGDATABASE ?? "ragdb",
    });

    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.docsDir = env.DOCS_DIR;
    this.adapters = [new TextAdapter(), new PdfAdapter()];
  }

  public async sync() {
    await this.ensureSchema();

    const files = this.getFilesFromDir(this.docsDir);
    console.log(`Found ${files.length} files in ${this.docsDir}, indexing...`);

    for (const file of files) {
      const filePath = path.join(this.docsDir, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const lastModified = stat.mtime;
      const existing = await this.getFileRecord(filePath);

      if (
        existing &&
        new Date(existing.last_modified).getTime() === lastModified.getTime()
      ) {
        console.log(`Skipping unchanged file: ${file}`);
        continue;
      }

      console.log(`Indexing file: ${file}`);

      const adapter = this.adapters.find((a) => a.supports(filePath));
      if (!adapter) {
        console.warn(`No adapter for file: ${file}, skipping...`);
        continue;
      }
      const text = await adapter.load(filePath);
      if (!text.trim()) {
        console.warn(`File ${file} produced empty text, skipping...`);
        continue;
      }

      const chunks = this.chunkText(text, this.CHUNK_SIZE);
      const embeddings = await this.embedText(chunks);

      const fileId = await this.upsertFile(filePath, lastModified);

      await this.clearFileChunks(fileId);
      await this.insertChunks(fileId, chunks, embeddings);
    }

    await this.pool.end();
    console.log("✅ Sync complete");
  }

  // ---------- PRIVATE HELPERS ----------

  private async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        last_modified TIMESTAMP NOT NULL,
        last_indexed TIMESTAMP NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS file_chunks (
        id SERIAL PRIMARY KEY,
        file_id INT REFERENCES files(id) ON DELETE CASCADE,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(1536)
      );
    `);
  }

  private chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  private async embedText(texts: string[]): Promise<number[][]> {
    const resp = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return resp.data.map((d) => d.embedding);
  }

  private async getFileRecord(filePath: string): Promise<any | null> {
    const res = await this.pool.query("SELECT * FROM files WHERE path = $1", [
      filePath,
    ]);
    return res.rows[0] || null;
  }

  private async upsertFile(
    filePath: string,
    lastModified: Date
  ): Promise<number> {
    const existing = await this.getFileRecord(filePath);

    if (existing) {
      await this.pool.query(
        "UPDATE files SET last_modified = $1, last_indexed = $2 WHERE id = $3",
        [lastModified, new Date(), existing.id]
      );
      return existing.id;
    } else {
      const res = await this.pool.query(
        "INSERT INTO files (path, last_modified, last_indexed) VALUES ($1, $2, $3) RETURNING id",
        [filePath, lastModified, new Date()]
      );
      return res.rows[0].id;
    }
  }

  private async clearFileChunks(fileId: number) {
    await this.pool.query("DELETE FROM file_chunks WHERE file_id = $1", [
      fileId,
    ]);
  }

  private async insertChunks(
    fileId: number,
    chunks: string[],
    embeddings: number[][]
  ) {
    for (let i = 0; i < chunks.length; i++) {
      await this.pool.query(
        "INSERT INTO file_chunks (file_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)",
        [fileId, i, chunks[i], `[${embeddings[i].join(",")}]`]
      );
    }
  }

  private getFilesFromDir(dir: string): string[] {
    const allEntries = fs.readdirSync(dir, { recursive: true }) as string[];
    console.log("Raw entries from readdirSync:", allEntries);

    const files = allEntries.filter((entry) => {
      const fullPath = path.join(dir, entry);
      const isFile = fs.statSync(fullPath).isFile();
      console.log(
        `Entry: ${entry}, Full path: ${fullPath}, Is file: ${isFile}`
      );
      return isFile;
    });

    console.log("Filtered files:", files);
    return files;
  }
}
