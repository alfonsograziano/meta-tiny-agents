export interface VectorStore {
  // File-based operations
  upsertFile(filePath: string, lastModified: Date): Promise<number>;
  deleteFile(fileId: number): Promise<void>;

  // Needed for filesystem sync
  deleteFileByPath(filePath: string): Promise<void>;

  // Memory-based operations
  upsertMemory(text: string, lastModified: Date): Promise<number>;
  deleteMemory(memoryId: number): Promise<void>;

  // Chunk operations
  clearChunksForFile(fileId: number): Promise<void>;
  clearChunksForMemory(memoryId: number): Promise<void>;
  insertChunksForFile(
    fileId: number,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void>;
  insertChunksForMemory(
    memoryId: number,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void>;

  // Query operation (shared for both types of chunks)
  query(
    embedding: number[],
    k: number
  ): Promise<{ id: number; source: string; content: string; score: number }[]>;

  // Metadata retrieval
  getFileRecord(
    filePath: string
  ): Promise<{ id: number; path: string; last_modified: Date } | null>;
  getMemoryRecord(
    memoryId: number
  ): Promise<{ id: number; text: string; last_modified: Date } | null>;

  getAllFileRecords(): Promise<
    { id: number; path: string; last_modified: Date }[]
  >;
  getAllMemoryRecords(): Promise<
    { id: number; text: string; last_modified: Date }[]
  >;

  deleteAllRecords(): Promise<void>;
}
