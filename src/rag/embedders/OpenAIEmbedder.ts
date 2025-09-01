import OpenAI from "openai";
import type { Embedder } from "./Embedder.ts";

export interface OpenAIEmbedderConfig {
  apiKey: string;
  model?: string;
}

export class OpenAIEmbedder implements Embedder {
  private openai: OpenAI;
  private model: string;

  constructor(config: OpenAIEmbedderConfig) {
    this.openai = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model ?? "text-embedding-3-small";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }
}
