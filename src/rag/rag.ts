import fs from "fs";
import path from "path";
import type { FileAdapter } from "./adapters/FileAdapter.ts";
import type { Embedder } from "./embedders/index.ts";
import type { VectorStore } from "./storage/VectorStore.js";

type TextSplitter = {
  //TODO: Implement (or steal fromm the internet) more strategies
  strategy: string;
  options: {
    chunkSize: number;
    chunkOverlapPercentage: number;
  };
};
export interface RAGConfig {
  logsAllowed?: boolean;
  embedder: Embedder;

  filesystemIndexing?: {
    workspaceDir: string;
    adapters: FileAdapter[];
  };

  vectorStore: VectorStore;

  textSplitter: TextSplitter;
}

export class RAG {
  private vectorStore: VectorStore;
  private embedder: Embedder;
  private filesystemIndexing?: {
    workspaceDir: string;
    adapters: FileAdapter[];
  };
  private logsAllowed: boolean;
  private textSplitter: TextSplitter;

  constructor(config: RAGConfig) {
    this.vectorStore = config.vectorStore;
    this.embedder = config.embedder;
    this.filesystemIndexing = config.filesystemIndexing;
    this.logsAllowed = config ? config.logsAllowed ?? false : false;
    this.textSplitter = config.textSplitter;
  }

  public async sync() {
    if (!this.filesystemIndexing) return;
    const dir = this.filesystemIndexing.workspaceDir;

    const files = this.getFilesFromDir(dir);
    this.log(`Found ${files.length} files in ${dir}, indexing...`);

    // Get all existing files from database
    const existingFiles = await this.vectorStore.getAllFileRecords();

    // Find deleted files (files in DB but not in filesystem)
    const deletedFiles = existingFiles.filter((dbFile) => {
      const fullPath = dbFile.path;
      return !fs.existsSync(fullPath);
    });

    // Deindex deleted files
    for (const deletedFile of deletedFiles) {
      this.log(`Deindexing deleted file: ${deletedFile.path}`);
      await this.vectorStore.deleteFile(deletedFile.id);
    }

    // Process existing files (index new/modified ones)
    for (const file of files) {
      await this.syncFile(file);
    }

    this.log("✅ Sync complete");
  }

  public async syncFile(filePath: string) {
    if (!this.filesystemIndexing)
      return this.log("🔄 No filesystem indexing configured, skipping...");
    this.log(`🔄 Syncing file: ${filePath}`);

    const exists = fs.existsSync(filePath);
    if (!exists) {
      this.log(`🔄 File ${filePath} deleted, deleting from database...`);
      await this.vectorStore.deleteFileByPath(filePath);
      return;
    }

    const stat = fs.statSync(filePath);
    const lastModified = stat.mtime;
    const existing = await this.vectorStore.getFileRecord(filePath);
    if (
      existing &&
      new Date(existing.last_modified).getTime() === lastModified.getTime()
    ) {
      this.log(`🔄 Skipping unchanged file: ${filePath}`);
      return;
    }
    this.log(`🔄 Indexing file: ${filePath}`);
    const adapter = this.filesystemIndexing.adapters.find((a) =>
      a.supports(filePath)
    );
    if (!adapter) {
      console.warn(`No adapter for file: ${filePath}, skipping...`);
      return;
    }
    const text = await adapter.load(filePath);
    if (!text.trim()) {
      console.warn(`File ${filePath} produced empty text, skipping...`);
      return;
    }
    const chunks = this.chunkText(text, {
      chunkSize: this.textSplitter.options.chunkSize,
      chunkOverlapPercentage: this.textSplitter.options.chunkOverlapPercentage,
    });
    const embeddings = await this.embedder.embed(chunks);
    const fileId = await this.vectorStore.upsertFile(filePath, lastModified);
    await this.vectorStore.clearChunksForFile(fileId);
    await this.vectorStore.insertChunksForFile(fileId, chunks, embeddings);
    this.log(`✅ File ${filePath} indexed`);
  }

  public async listenForChanges() {
    if (!this.filesystemIndexing)
      return this.log("🔄 No filesystem indexing configured, skipping...");
    const workspaceDir = this.filesystemIndexing.workspaceDir;
    this.log("🔄 Starting to listen for changes...");

    fs.watch(workspaceDir, (eventType, filename) => {
      if (!filename) return;
      this.syncFile(path.join(workspaceDir, filename));
    });
  }

  public async reindexAll() {
    this.log("🔄 Starting full re-index...");

    // Delete all existing data
    this.log("🗑️  Clearing all existing indexed data...");
    await this.vectorStore.deleteAllRecords();
    this.log("✅ All existing data cleared");

    await this.sync();
  }

  public async query(query: string, k: number = 5) {
    // 1. Generate embedding
    const [embedding] = await this.embedder.embed([query]);

    return this.vectorStore.query(embedding, k);
  }

  public async indexMemoryById(memoryId: number, data: string) {
    // Chunk the text and create embeddings
    const chunks = this.chunkText(data, {
      chunkSize: this.textSplitter.options.chunkSize,
      chunkOverlapPercentage: this.textSplitter.options.chunkOverlapPercentage,
    });
    const embeddings = await this.embedder.embed(chunks);

    // Insert chunks with memory_id instead of file_id
    for (let i = 0; i < chunks.length; i++) {
      await this.vectorStore.insertChunksForMemory(
        memoryId,
        chunks,
        embeddings
      );
    }

    this.log(`Indexed text as memory with ${chunks.length} chunks`);
    return memoryId;
  }

  // Memory management methods
  public async createMemory(content: string) {
    const memoryId = await this.vectorStore.upsertMemory(content, new Date());

    await this.indexMemoryById(memoryId, content);

    const memoryRecord = await this.vectorStore.getMemoryRecord(memoryId);
    if (!memoryRecord) {
      throw new Error("Failed to create memory record");
    }
    return memoryRecord;
  }

  public async getMemory(id: number) {
    return this.vectorStore.getMemoryRecord(id);
  }

  public async listMemories() {
    return this.vectorStore.getAllMemoryRecords();
  }

  public async updateMemory(id: number, content: string) {
    const existingMemory = await this.vectorStore.getMemoryRecord(id);
    if (!existingMemory) {
      return null;
    }

    await this.vectorStore.clearChunksForMemory(id);
    await this.vectorStore.updateMemory(id, content);
    await this.indexMemoryById(id, content);

    return this.vectorStore.getMemoryRecord(id);
  }

  public async deleteMemory(id: number) {
    const existingMemory = await this.vectorStore.getMemoryRecord(id);
    if (!existingMemory) {
      return false;
    }
    await this.vectorStore.deleteMemory(id);
    return true;
  }

  // ---------- PRIVATE HELPERS ----------

  // Drop-in: same name + (optional) overlap parameter via a default.
  private chunkText(
    text: string,
    options: {
      chunkSize: number;
      chunkOverlapPercentage: number;
    }
  ): string[] {
    if (typeof text !== "string") return [];
    let size = options.chunkSize;
    let overlap = Math.floor(
      (options.chunkSize * options.chunkOverlapPercentage) / 100
    );

    if (!Number.isFinite(options.chunkSize) || options.chunkSize <= 0)
      return [text];
    if (!Number.isFinite(overlap) || overlap < 0) overlap = 0;
    if (overlap >= options.chunkSize)
      overlap = Math.max(0, Math.floor(options.chunkSize / 3)); // keep sane

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

  private getFilesFromDir(dir: string): string[] {
    const allEntries = fs.readdirSync(dir, { recursive: true }) as string[];

    const files = allEntries.filter((entry) => {
      const fullPath = path.join(dir, entry);
      const isFile = fs.statSync(fullPath).isFile();
      return isFile;
    });

    this.log("Files found:", files);
    return files;
  }

  private log(...args: any[]) {
    if (this.logsAllowed) {
      console.log("[RAG]", ...args);
    }
  }
}
