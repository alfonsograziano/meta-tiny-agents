import { Pool } from "pg";
import OpenAI from "openai";

type Env = {
  OPENAI_API_KEY?: string;
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
};

export class RAGQuery {
  private pool: Pool;
  private openai: OpenAI;

  constructor(env: Env = process.env as Env) {
    if (!env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    this.pool = new Pool({
      host: env.PGHOST ?? "localhost",
      port: Number(env.PGPORT ?? 5432),
      user: env.PGUSER ?? "postgres",
      password: env.PGPASSWORD ?? "postgres",
      database: env.PGDATABASE ?? "ragdb",
    });

    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /**
   * Query the vector DB for top-k most similar chunks
   */
  public async query(query: string, k: number = 5) {
    // 1. Generate embedding
    const embedding = await this.getEmbedding(query);

    // 2. Search DB
    const res = await this.pool.query(
      `
      SELECT
        file_chunks.id,
        file_chunks.content,
        files.path,
        file_chunks.embedding <-> $1::vector AS distance
      FROM file_chunks
      JOIN files ON file_chunks.file_id = files.id
      ORDER BY file_chunks.embedding <-> $1::vector
      LIMIT $2
    `,
      [`[${embedding.join(",")}]`, k]
    );

    return res.rows.map((row) => ({
      id: row.id,
      file: row.path,
      content: row.content,
      score: 1 - row.distance, // cosine similarity (closer to 1 = more similar)
    }));
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const resp = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return resp.data[0].embedding;
  }
}
