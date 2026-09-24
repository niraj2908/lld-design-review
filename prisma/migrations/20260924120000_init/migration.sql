-- DesignReview initial schema.
--
-- pgvector is enabled here so that the database is ready for the retrieval
-- milestone. No vector column or index exists yet: this milestone adds the
-- capability, not the feature.
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('MUST', 'SHOULD', 'COULD');

-- CreateEnum
CREATE TYPE "SubmissionFormatType" AS ENUM ('STRUCTURED_DESIGN');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EVALUATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'EVALUATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('ASSOCIATION', 'AGGREGATION', 'COMPOSITION', 'INHERITANCE', 'IMPLEMENTATION', 'DEPENDENCY');

-- CreateEnum
CREATE TYPE "EvaluationCriterion" AS ENUM ('REQUIREMENT_UNDERSTANDING', 'RESPONSIBILITY', 'ENCAPSULATION', 'COHESION', 'COUPLING', 'ABSTRACTION', 'EXTENSIBILITY', 'EDGE_CASES', 'DESIGN_REASONING', 'TESTABILITY');

-- CreateEnum
CREATE TYPE "CriterionAssessment" AS ENUM ('STRONG', 'ADEQUATE', 'NEEDS_IMPROVEMENT', 'MISSING');

-- CreateEnum
CREATE TYPE "FeedbackPriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateTable
CREATE TABLE "learners" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "constraints" TEXT[],
    "acceptedSubmissionFormats" "SubmissionFormatType"[],
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "RequirementPriority" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_rubrics" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "version" TEXT NOT NULL,

    CONSTRAINT "problem_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "criterion" "EvaluationCriterion" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "guidance" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "draftDesignId" TEXT,
    "currentSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_classes" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "methods" JSONB NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_interfaces" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "methods" JSONB NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_interfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_relationships" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "cardinality" TEXT,
    "rationale" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_decisions" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "tradeoff" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_edge_cases" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_edge_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_requirement_mappings" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_requirement_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_requirement_mapping_references" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT,
    "value" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "design_requirement_mapping_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "formatType" "SubmissionFormatType" NOT NULL,
    "designId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "status" "EvaluationStatus" NOT NULL,
    "evaluatorVersion" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "knowledgeVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "summary" TEXT,
    "confidence" DOUBLE PRECISION,
    "strengths" TEXT[],
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_criterion_results" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterion" "EvaluationCriterion" NOT NULL,
    "assessment" "CriterionAssessment" NOT NULL,
    "concern" TEXT,
    "suggestion" TEXT,
    "confidence" DOUBLE PRECISION,
    "position" INTEGER NOT NULL,

    CONSTRAINT "evaluation_criterion_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_criterion_evidence" (
    "id" TEXT NOT NULL,
    "criterionResultId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT,
    "value" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "evaluation_criterion_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_feedback_items" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "priority" "FeedbackPriority" NOT NULL,
    "criterion" "EvaluationCriterion",
    "what" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "reconsider" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "evaluation_feedback_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_feedback_evidence" (
    "id" TEXT NOT NULL,
    "feedbackItemId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "field" TEXT,
    "value" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "evaluation_feedback_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "problems_slug_key" ON "problems"("slug");

-- CreateIndex
CREATE INDEX "requirements_problemId_idx" ON "requirements"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_problemId_code_key" ON "requirements"("problemId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "problem_rubrics_problemId_key" ON "problem_rubrics"("problemId");

-- CreateIndex
CREATE INDEX "rubric_criteria_rubricId_idx" ON "rubric_criteria"("rubricId");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_criteria_rubricId_criterion_key" ON "rubric_criteria"("rubricId", "criterion");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_draftDesignId_key" ON "attempts"("draftDesignId");

-- CreateIndex
CREATE INDEX "attempts_learnerId_problemId_idx" ON "attempts"("learnerId", "problemId");

-- CreateIndex
CREATE INDEX "attempts_problemId_idx" ON "attempts"("problemId");

-- CreateIndex
CREATE INDEX "attempts_status_idx" ON "attempts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_learnerId_problemId_attemptNumber_key" ON "attempts"("learnerId", "problemId", "attemptNumber");

-- CreateIndex
CREATE INDEX "design_classes_designId_idx" ON "design_classes"("designId");

-- CreateIndex
CREATE UNIQUE INDEX "design_classes_designId_name_key" ON "design_classes"("designId", "name");

-- CreateIndex
CREATE INDEX "design_interfaces_designId_idx" ON "design_interfaces"("designId");

-- CreateIndex
CREATE UNIQUE INDEX "design_interfaces_designId_name_key" ON "design_interfaces"("designId", "name");

-- CreateIndex
CREATE INDEX "design_relationships_designId_idx" ON "design_relationships"("designId");

-- CreateIndex
CREATE UNIQUE INDEX "design_relationships_designId_source_target_type_key" ON "design_relationships"("designId", "source", "target", "type");

-- CreateIndex
CREATE INDEX "design_decisions_designId_idx" ON "design_decisions"("designId");

-- CreateIndex
CREATE INDEX "design_edge_cases_designId_idx" ON "design_edge_cases"("designId");

-- CreateIndex
CREATE INDEX "design_requirement_mappings_designId_idx" ON "design_requirement_mappings"("designId");

-- CreateIndex
CREATE INDEX "design_requirement_mappings_requirementId_idx" ON "design_requirement_mappings"("requirementId");

-- CreateIndex
CREATE INDEX "design_requirement_mapping_references_mappingId_idx" ON "design_requirement_mapping_references"("mappingId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_designId_key" ON "submissions"("designId");

-- CreateIndex
CREATE INDEX "submissions_attemptId_idx" ON "submissions"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_attemptId_version_key" ON "submissions"("attemptId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_idempotencyKey_key" ON "evaluations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "evaluations_submissionId_idx" ON "evaluations"("submissionId");

-- CreateIndex
CREATE INDEX "evaluations_status_idx" ON "evaluations"("status");

-- CreateIndex
CREATE INDEX "evaluation_criterion_results_evaluationId_idx" ON "evaluation_criterion_results"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_criterion_results_evaluationId_criterion_key" ON "evaluation_criterion_results"("evaluationId", "criterion");

-- CreateIndex
CREATE INDEX "evaluation_criterion_evidence_criterionResultId_idx" ON "evaluation_criterion_evidence"("criterionResultId");

-- CreateIndex
CREATE INDEX "evaluation_feedback_items_evaluationId_idx" ON "evaluation_feedback_items"("evaluationId");

-- CreateIndex
CREATE INDEX "evaluation_feedback_evidence_feedbackItemId_idx" ON "evaluation_feedback_evidence"("feedbackItemId");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_rubrics" ADD CONSTRAINT "problem_rubrics_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "problem_rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_draftDesignId_fkey" FOREIGN KEY ("draftDesignId") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_classes" ADD CONSTRAINT "design_classes_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_interfaces" ADD CONSTRAINT "design_interfaces_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_relationships" ADD CONSTRAINT "design_relationships_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_decisions" ADD CONSTRAINT "design_decisions_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_edge_cases" ADD CONSTRAINT "design_edge_cases_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_requirement_mappings" ADD CONSTRAINT "design_requirement_mappings_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_requirement_mappings" ADD CONSTRAINT "design_requirement_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_requirement_mapping_references" ADD CONSTRAINT "design_requirement_mapping_references_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "design_requirement_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_criterion_results" ADD CONSTRAINT "evaluation_criterion_results_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_criterion_evidence" ADD CONSTRAINT "evaluation_criterion_evidence_criterionResultId_fkey" FOREIGN KEY ("criterionResultId") REFERENCES "evaluation_criterion_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_feedback_items" ADD CONSTRAINT "evaluation_feedback_items_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_feedback_evidence" ADD CONSTRAINT "evaluation_feedback_evidence_feedbackItemId_fkey" FOREIGN KEY ("feedbackItemId") REFERENCES "evaluation_feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

