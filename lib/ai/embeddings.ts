import { pipeline } from "@xenova/transformers";

export const EMBEDDING_MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSION = 384;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL_NAME);
  }
  return extractorPromise;
}

/**
 * Generates an embedding vector (length 384) using local all-MiniLM-L6-v2.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const cleanText = text.replace(/\n+/g, " ").trim();
  const output = await extractor(cleanText, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Generates embeddings for a batch of texts.
 */
export async function createEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (const t of texts) {
    const emb = await createEmbedding(t);
    results.push(emb);
  }
  return results;
}
