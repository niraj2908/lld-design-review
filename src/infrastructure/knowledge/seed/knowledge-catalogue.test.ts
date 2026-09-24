import { describe, expect, it } from "vitest";
import { chunkDocument } from "@/domain/knowledge/chunking";
import { assertValidKnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import {
  isKnowledgeSlug,
  knowledgeDocumentId,
} from "@/domain/knowledge/knowledge-identity";
import { KNOWLEDGE_TOPICS } from "@/domain/knowledge/knowledge-topic";
import { SEED_PROBLEMS } from "../../persistence/seed/problem-catalogue";
import { KNOWLEDGE_DOCUMENTS, KNOWLEDGE_VERSION } from "./knowledge-catalogue";

const CASES = KNOWLEDGE_DOCUMENTS.map(
  (document) => [document.slug, document] as const,
);

describe("the curated knowledge base", () => {
  it("is versioned", () => {
    expect(KNOWLEDGE_VERSION).toBe("lld-kb-v1");
    for (const document of KNOWLEDGE_DOCUMENTS) {
      expect(document.version).toBe(KNOWLEDGE_VERSION);
    }
  });

  it("uses unique slugs and derived ids", () => {
    const slugs = KNOWLEDGE_DOCUMENTS.map((document) => document.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
    for (const document of KNOWLEDGE_DOCUMENTS) {
      expect(document.id).toBe(knowledgeDocumentId(document.slug));
      expect(isKnowledgeSlug(document.slug)).toBe(true);
    }
  });

  it.each(CASES)("%s satisfies the document invariants", (_slug, document) => {
    expect(() => assertValidKnowledgeDocument(document)).not.toThrow();
    expect(document.content.length).toBeGreaterThan(300);
    expect(document.metadata.concepts.length).toBeGreaterThan(0);
    expect(document.source.length).toBeGreaterThan(0);
  });

  it("covers every topic the evaluator can filter by", () => {
    const covered = new Set(KNOWLEDGE_DOCUMENTS.map((document) => document.topic));

    expect([...covered].toSorted()).toEqual([...KNOWLEDGE_TOPICS].toSorted());
  });

  it.each([
    ["OOP fundamentals", "OOP", ["responsibility", "encapsulation", "abstraction", "composition", "cohesion", "coupling", "testability"]],
    ["SOLID", "SOLID", ["srp", "ocp", "lsp", "isp", "dip"]],
    ["patterns", "PATTERN", ["strategy", "state", "observer", "factory", "decorator"]],
    ["design smells", "DESIGN_SMELL", ["god-object", "tight-coupling", "shotgun-surgery", "anemic-domain-model", "premature-abstraction"]],
    ["LLD reasoning", "LLD_REASONING", ["requirement-to-design-mapping", "state-modelling", "edge-cases", "extensibility", "interface-responsibilities"]],
  ] as const)("covers the %s the specification lists", (_label, topic, expected) => {
    const slugs = KNOWLEDGE_DOCUMENTS.filter(
      (document) => document.topic === topic,
    )
      .map((document) => document.slug)
      .join(" ");

    for (const concept of expected) {
      expect(slugs).toContain(concept);
    }
  });

  it("has guidance for each of the four seeded problems", () => {
    const guidance = KNOWLEDGE_DOCUMENTS.filter(
      (document) => document.topic === "PROBLEM_GUIDANCE",
    );

    expect(guidance).toHaveLength(SEED_PROBLEMS.length);
    expect(
      guidance.map((document) => document.metadata.problemSlug).toSorted(),
    ).toEqual(SEED_PROBLEMS.map((problem) => problem.slug).toSorted());
  });

  it("tags only problem guidance with a problem", () => {
    for (const document of KNOWLEDGE_DOCUMENTS) {
      if (document.topic === "PROBLEM_GUIDANCE") {
        expect(document.metadata.problemSlug).toBeDefined();
      } else {
        expect(document.metadata.problemSlug).toBeUndefined();
      }
    }
  });

  /**
   * The guard that keeps retrieval from becoming comparison. A document that
   * described the classes a problem "should" have would be an answer key, whatever
   * the surrounding prose said.
   */
  it.each(CASES)("%s prescribes no solution", (_slug, document) => {
    const prose = document.content.toLowerCase();

    for (const banned of [
      "the correct design",
      "the correct solution",
      "reference solution",
      "reference design",
      "model answer",
      "the ideal design",
      "you should create a class called",
      "the expected classes are",
      "class diagram:",
    ]) {
      expect(prose).not.toContain(banned);
    }
  });

  it.each(CASES)("%s frames guidance as reasoning, not instruction", (_slug, document) => {
    // A document that enumerated required elements would read as a checklist of
    // classes; the catalogue talks about properties instead.
    expect(document.content).not.toMatch(/^\s*(class|interface)\s+[A-Z]\w*\s*\{/mu);
  });

  it("names the variation points rather than the elements for each problem", () => {
    const parking = KNOWLEDGE_DOCUMENTS.find(
      (document) => document.metadata.problemSlug === "parking-lot",
    );

    expect(parking?.content).toContain("no expected set of elements");
  });

  it("chunks into a reasonable number of retrievable passages", () => {
    const chunks = KNOWLEDGE_DOCUMENTS.flatMap((document) =>
      chunkDocument(document),
    );

    expect(chunks.length).toBeGreaterThanOrEqual(KNOWLEDGE_DOCUMENTS.length);
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
  });
});
