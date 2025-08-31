import { Pool } from "pg";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import type { FileAdapter } from "./adapters/FileAdapter.ts";
import { TextAdapter, PdfAdapter } from "./adapters/index.ts";

export type Env = {
  OPENAI_API_KEY?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
  DOCS_DIR?: string;
};

export class RAG {
  private pool: Pool;
  private openai: OpenAI;
  private docsDir: string;
  private readonly CHUNK_SIZE = 500;
  private adapters: FileAdapter[];
  private logsAllowed: boolean;

  constructor(
    env: Env = process.env as Env,
    config?: {
      logsAllowed?: boolean;
    }
  ) {
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
    this.logsAllowed = config ? config.logsAllowed ?? false : false;
  }

  public async sync() {
    const files = this.getFilesFromDir(this.docsDir);
    this.log(`Found ${files.length} files in ${this.docsDir}, indexing...`);

    // Get all existing files from database
    const existingFiles = await this.getAllFileRecords();

    // Find deleted files (files in DB but not in filesystem)
    const deletedFiles = existingFiles.filter((dbFile) => {
      const fullPath = dbFile.path;
      return !fs.existsSync(fullPath);
    });

    // Deindex deleted files
    for (const deletedFile of deletedFiles) {
      this.log(`Deindexing deleted file: ${deletedFile.path}`);
      await this.deleteFileRecord(deletedFile.id);
    }

    // Process existing files (index new/modified ones)
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
        this.log(`Skipping unchanged file: ${file}`);
        continue;
      }

      this.log(`Indexing file: ${file}`);

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

    this.log("✅ Sync complete");
  }

  public async reindexAll() {
    this.log("🔄 Starting full re-index...");

    // Delete all existing data
    this.log("🗑️  Clearing all existing indexed data...");
    await this.pool.query("DELETE FROM memory_chunks");
    await this.pool.query("DELETE FROM memory");
    await this.pool.query("DELETE FROM files");
    this.log("✅ All existing data cleared");

    await this.sync();
  }

  public async query(query: string, k: number = 5) {
    // 1. Generate embedding
    const embedding = await this.embedText([query]);

    // 2. Search DB - now handles both file-based and memory-based chunks
    const res = await this.pool.query(
      `
      SELECT
        mc.id,
        mc.content,
        COALESCE(f.path, 'memory') as source,
        mc.embedding <-> $1::vector AS distance
      FROM memory_chunks mc
      LEFT JOIN files f ON mc.file_id = f.id
      ORDER BY mc.embedding <-> $1::vector
      LIMIT $2
    `,
      [`[${embedding.join(",")}]`, k]
    );

    return res.rows.map((row) => ({
      id: row.id,
      source: row.source,
      content: row.content,
      score: 1 - row.distance, // cosine similarity (closer to 1 = more similar)
    }));
  }

  public async indexText(data: string) {
    // Create a new memory record instead of a file
    const res = await this.pool.query(
      "INSERT INTO memory (text, last_modified) VALUES ($1, $2) RETURNING id",
      [data, new Date()]
    );

    const memoryId = res.rows[0].id;

    // Chunk the text and create embeddings
    const chunks = this.chunkText(data, this.CHUNK_SIZE);
    const embeddings = await this.embedText(chunks);

    // Insert chunks with memory_id instead of file_id
    for (let i = 0; i < chunks.length; i++) {
      await this.pool.query(
        "INSERT INTO memory_chunks (memory_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)",
        [memoryId, i, chunks[i], `[${embeddings[i].join(",")}]`]
      );
    }

    this.log(`Indexed text as memory with ${chunks.length} chunks`);
  }

  // ---------- PRIVATE HELPERS ----------

  // Drop-in: same name + (optional) overlap parameter via a default.
  private chunkText(
    text: string,
    size: number,
    overlap: number = Math.floor(size * 0.15)
  ): string[] {
    if (typeof text !== "string") return [];
    if (!Number.isFinite(size) || size <= 0) return [text];
    if (!Number.isFinite(overlap) || overlap < 0) overlap = 0;
    if (overlap >= size) overlap = Math.max(0, Math.floor(size / 3)); // keep sane

    const SEPARATORS = ["\n\n", "\n", " ", ""]; // paragraphs -> lines -> words -> chars

    const splitRecursive = (
      input: string,
      max: number,
      seps: string[]
    ): string[] => {
      const t = input;
      if (t.length <= max) return [t];

      for (let i = 0; i < seps.length; i++) {
        const sep = seps[i];

        if (sep === "") {
          const out: string[] = [];
          for (let j = 0; j < t.length; j += max) out.push(t.slice(j, j + max));
          return out;
        }

        if (t.includes(sep)) {
          const rawParts = t.split(sep);
          const parts: string[] = [];
          for (const part of rawParts) {
            if (!part) continue;
            if (part.length <= max) {
              parts.push(part);
            } else {
              parts.push(...splitRecursive(part, max, seps.slice(i + 1)));
            }
          }

          // Merge with max size constraint
          const baseChunks: string[] = [];
          let current = "";
          for (const p of parts) {
            if (!p) continue;
            if (current.length === 0) {
              current = p;
            } else if (current.length + sep.length + p.length <= max) {
              current += sep + p;
            } else {
              baseChunks.push(current);
              current = p;
            }
          }
          if (current) baseChunks.push(current);

          // Apply overlap: start each subsequent chunk with a suffix of the previous one.
          if (overlap <= 0 || baseChunks.length <= 1) return baseChunks;

          const overlapped: string[] = [];
          overlapped.push(baseChunks[0]); // first chunk unchanged

          for (let k = 1; k < baseChunks.length; k++) {
            const prev = overlapped[overlapped.length - 1];
            const seed = prev.slice(Math.max(0, prev.length - overlap)); // suffix

            let next = baseChunks[k];

            // If adding the seed exceeds max, trim the front of `next` just enough.
            const available = size - seed.length;
            if (available <= 0) {
              // Seed alone fills (or exceeds) the budget; fall back to cropping seed.
              const croppedSeed = seed.slice(-Math.max(0, size - 1));
              overlapped.push(croppedSeed);
              // Re-insert the remainder of `next` as further chunks respecting size
              let rest = next;
              while (rest.length > 0) {
                overlapped.push(rest.slice(0, size));
                rest = rest.slice(size);
              }
              continue;
            }
            if (next.length > available) {
              next = next.slice(0, available);
            }
            overlapped.push(seed + next);
          }
          return overlapped;
        }
      }

      // Safety fallback
      const out: string[] = [];
      for (let i = 0; i < t.length; i += max) out.push(t.slice(i, i + max));
      return out;
    };

    return splitRecursive(text, size, SEPARATORS);
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
        "INSERT INTO files (path, last_modified, last_indexed, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id",
        [filePath, lastModified, new Date()]
      );
      return res.rows[0].id;
    }
  }

  private async clearFileChunks(fileId: number) {
    await this.pool.query("DELETE FROM memory_chunks WHERE file_id = $1", [
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
        "INSERT INTO memory_chunks (file_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4)",
        [fileId, i, chunks[i], `[${embeddings[i].join(",")}]`]
      );
    }
  }

  private async getAllFileRecords(): Promise<any[]> {
    const res = await this.pool.query("SELECT * FROM files");
    return res.rows;
  }

  private async deleteFileRecord(fileId: number) {
    // Due to CASCADE constraint, deleting from files will automatically
    // delete all related chunks from memory_chunks table
    await this.pool.query("DELETE FROM files WHERE id = $1", [fileId]);
  }

  private getFilesFromDir(dir: string): string[] {
    const allEntries = fs.readdirSync(dir, { recursive: true }) as string[];
    this.log("Raw entries from readdirSync:", allEntries);

    const files = allEntries.filter((entry) => {
      const fullPath = path.join(dir, entry);
      const isFile = fs.statSync(fullPath).isFile();
      this.log(`Entry: ${entry}, Full path: ${fullPath}, Is file: ${isFile}`);
      return isFile;
    });

    this.log("Filtered files:", files);
    return files;
  }

  private log(...args: any[]) {
    if (this.logsAllowed) {
      console.log(...args);
    }
  }
}
