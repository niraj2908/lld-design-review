-- NOTE: `prisma migrate dev` wanted to drop "knowledge_chunks_embedding_idx" here.
-- That index is the HNSW cosine index added by hand in 20260924165418_add_knowledge_base,
-- because Prisma cannot express a vector index and so does not know it should exist.
-- The DROP was removed deliberately: losing it would turn every similarity search
-- into a sequential scan with no other symptom. Expect the same spurious DROP in
-- future generated migrations, and remove it the same way.

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "embeddingModel" TEXT;

-- CreateTable
CREATE TABLE "evaluation_knowledge_citations" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "chunkId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "embeddingModel" TEXT NOT NULL,

    CONSTRAINT "evaluation_knowledge_citations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_knowledge_citations_evaluationId_idx" ON "evaluation_knowledge_citations"("evaluationId");

-- CreateIndex
CREATE INDEX "evaluation_knowledge_citations_documentId_idx" ON "evaluation_knowledge_citations"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_knowledge_citations_evaluationId_chunkId_key" ON "evaluation_knowledge_citations"("evaluationId", "chunkId");

-- AddForeignKey
ALTER TABLE "evaluation_knowledge_citations" ADD CONSTRAINT "evaluation_knowledge_citations_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
