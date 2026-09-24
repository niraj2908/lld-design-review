-- CreateEnum
CREATE TYPE "KnowledgeTopic" AS ENUM ('OOP', 'SOLID', 'PATTERN', 'DESIGN_SMELL', 'LLD_REASONING', 'PROBLEM_GUIDANCE');

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "topic" "KnowledgeTopic" NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "problemSlug" TEXT,
    "concepts" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "topic" "KnowledgeTopic" NOT NULL,
    "problemSlug" TEXT,
    "concepts" TEXT[],
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_slug_key" ON "knowledge_documents"("slug");

-- CreateIndex
CREATE INDEX "knowledge_documents_topic_idx" ON "knowledge_documents"("topic");

-- CreateIndex
CREATE INDEX "knowledge_documents_problemSlug_idx" ON "knowledge_documents"("problemSlug");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_topic_idx" ON "knowledge_chunks"("topic");

-- CreateIndex
CREATE INDEX "knowledge_chunks_problemSlug_idx" ON "knowledge_chunks"("problemSlug");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_documentId_chunkIndex_key" ON "knowledge_chunks"("documentId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Approximate-nearest-neighbour index for cosine distance, which is what
-- PrismaKnowledgeRepository searches by. HNSW rather than IVFFlat because it needs
-- no training pass and behaves sensibly on a knowledge base this small.
CREATE INDEX "knowledge_chunks_embedding_idx"
  ON "knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops);
