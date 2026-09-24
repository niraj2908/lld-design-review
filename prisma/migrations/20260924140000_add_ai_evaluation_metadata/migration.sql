-- AlterTable
ALTER TABLE "evaluation_criterion_results" ADD COLUMN     "unverifiedEvidenceCount" INTEGER;

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT;
