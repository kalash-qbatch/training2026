-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding vector column with 768 dimensions (for Gemini text-embedding-004)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Add cosine similarity index using HNSW for high-performance vector retrieval
CREATE INDEX IF NOT EXISTS "Product_embedding_cosine_idx" 
ON "Product" USING hnsw ("embedding" vector_cosine_ops);
