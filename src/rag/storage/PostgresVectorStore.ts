import { Pool } from "pg";
import type { VectorStore } from "./VectorStore.js";

export class PostgresVectorStore implements VectorStore {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async upsertFile(filePath: string, lastModified: Date): Promise<number> {
    const res = await this.pool.query("SELECT id FROM files WHERE path = $1", [
      filePath,
    ]);
    if (res.rowCount) {
      await this.pool.query(
        "UPDATE files SET last_modified = $1, last_indexed = $2 WHERE id = $3",
        [lastModified, new Date(), res.rows[0].id]
      );
      return res.rows[0].id;
    }
    const insert = await this.pool.query(
      `INSERT INTO files (path, last_modified, last_indexed, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id`,
      [filePath, lastModified, new Date()]
    );
    return insert.rows[0].id;
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.pool.query("DELETE FROM files WHERE id = $1", [fileId]);
  }

  async upsertMemory(text: string, lastModified: Date): Promise<number> {
    const res = await this.pool.query(
      "INSERT INTO memory (text, last_modified, created_at) VALUES ($1, $2, $3) RETURNING id",
      [text, lastModified, new Date()]
    );
    return res.rows[0].id;
  }

  async deleteMemory(memoryId: number): Promise<void> {
    await this.pool.query("DELETE FROM memory WHERE id = $1", [memoryId]);
  }

  async clearChunksForFile(fileId: number): Promise<void> {
    await this.pool.query("DELETE FROM memory_chunks WHERE file_id = $1", [
      fileId,
    ]);
  }

  async clearChunksForMemory(memoryId: number): Promise<void> {
    await this.pool.query("DELETE FROM memory_chunks WHERE memory_id = $1", [
      memoryId,
    ]);
  }

  async insertChunksForFile(
    fileId: number,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void> {
    const promises = chunks.map((chunk, i) =>
      this.pool.query(
        `INSERT INTO memory_chunks
         (file_id, chunk_index, content, embedding, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [fileId, i, chunk, `[${embeddings[i].join(",")}]`]
      )
    );
    await Promise.all(promises);
  }

  async insertChunksForMemory(
    memoryId: number,
    chunks: string[],
    embeddings: number[][]
  ): Promise<void> {
    const promises = chunks.map((chunk, i) =>
      this.pool.query(
        `INSERT INTO memory_chunks
         (memory_id, chunk_index, content, embedding, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [memoryId, i, chunk, `[${embeddings[i].join(",")}]`]
      )
    );
    await Promise.all(promises);
  }

  async query(
    embedding: number[],
    k: number
  ): Promise<{ id: number; source: string; content: string; score: number }[]> {
    const res = await this.pool.query(
      `
        SELECT mc.id, mc.content,
          COALESCE(f.path, m.text, 'unknown') AS source,
          mc.embedding <-> $1::vector AS distance
        FROM memory_chunks mc
        LEFT JOIN files f ON mc.file_id = f.id
        LEFT JOIN memory m ON mc.memory_id = m.id
        ORDER BY distance
        LIMIT $2
      `,
      [`[${embedding.join(",")}]`, k]
    );
    return res.rows.map((row: any) => ({
      id: row.id,
      source: row.source,
      content: row.content,
      score: 1 - row.distance,
    }));
  }

  async getFileRecord(
    filePath: string
  ): Promise<{ id: number; path: string; last_modified: Date } | null> {
    const res = await this.pool.query(
      "SELECT id, path, last_modified FROM files WHERE path = $1",
      [filePath]
    );
    return res.rows[0] ?? null;
  }

  async getMemoryRecord(
    memoryId: number
  ): Promise<{ id: number; text: string; last_modified: Date } | null> {
    const res = await this.pool.query(
      "SELECT id, text, last_modified FROM memory WHERE id = $1",
      [memoryId]
    );
    return res.rows[0] ?? null;
  }

  async getAllFileRecords(): Promise<
    { id: number; path: string; last_modified: Date }[]
  > {
    const res = await this.pool.query(
      "SELECT id, path, last_modified FROM files"
    );
    return res.rows;
  }

  async getAllMemoryRecords(): Promise<
    { id: number; text: string; last_modified: Date }[]
  > {
    const res = await this.pool.query(
      "SELECT id, text, last_modified FROM memory"
    );
    return res.rows;
  }

  async deleteAllRecords(): Promise<void> {
    await this.pool.query("DELETE FROM memory_chunks");
    await this.pool.query("DELETE FROM memory");
    await this.pool.query("DELETE FROM files");
  }

  async deleteFileRecord(fileId: number): Promise<void> {
    await this.pool.query("DELETE FROM files WHERE id = $1", [fileId]);
  }

  async deleteMemoryRecord(memoryId: number): Promise<void> {
    await this.pool.query("DELETE FROM memory WHERE id = $1", [memoryId]);
  }
}
