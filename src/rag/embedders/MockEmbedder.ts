import type { Embedder } from "./Embedder.ts";

export interface MockEmbedderConfig {
  vectorSize?: number;
}

export class MockEmbedder implements Embedder {
  private vectorSize: number;

  constructor(config: MockEmbedderConfig = {}) {
    this.vectorSize = config.vectorSize ?? 1536; // Default to OpenAI's text-embedding-3-small size
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateDeterministicEmbedding(text));
  }

  private generateDeterministicEmbedding(text: string): number[] {
    // Simple hash function to generate deterministic numbers from text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Generate a deterministic vector based on the hash
    const vector: number[] = [];
    for (let i = 0; i < this.vectorSize; i++) {
      // Use different parts of the hash for each dimension
      const seed = hash + i * 31;
      const value = Math.sin(seed) * 0.5 + 0.5; // Normalize to [0, 1]
      vector.push(value);
    }

    return vector;
  }
}
