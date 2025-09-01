export interface Embedder {
  /**
   * Generates embeddings for an array of text strings
   * @param texts Array of text strings to embed
   * @returns Promise resolving to array of embedding vectors (each vector is an array of numbers)
   */
  embed(texts: string[]): Promise<number[][]>;
}
