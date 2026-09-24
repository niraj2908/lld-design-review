import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");

const FORBIDDEN_IN_DOMAIN = [
  /^next(\/|$)/,
  /^react(-dom)?(\/|$)/,
  /^@prisma\//,
  /^prisma(\/|$)/,
  /^pg(\/|$)/,
  /^groq-sdk(\/|$)/,
  /^openai(\/|$)/,
  /^kafkajs(\/|$)/,
  /^(io)?redis(\/|$)/,
  /^node:/,
  /^(fs|path|http|https|crypto|child_process)$/,
  /^@\/application\//,
  /^@\/infrastructure\//,
  /^@\/app\//,
  /^@\/testing\//,
];

/** Prisma's generated client is infrastructure, wherever it is emitted. */
const GENERATED_CLIENT = /infrastructure\/persistence\/prisma\/client/;

/**
 * The evaluation engine is domain logic with an application port for a seam. It
 * must stay as infrastructure-free as the domain itself.
 */
const FORBIDDEN_IN_ENGINE = [
  /^next(\/|$)/,
  /^react(-dom)?(\/|$)/,
  /^@prisma\//,
  /^prisma(\/|$)/,
  /^pg(\/|$)/,
  /^groq-sdk(\/|$)/,
  /^openai(\/|$)/,
  /^kafkajs(\/|$)/,
  /^(io)?redis(\/|$)/,
  /^node:/,
  /^(fs|path|http|https|crypto|child_process)$/,
  /^@\/infrastructure\//,
  /^@\/app\//,
  /^@\/testing\//,
];

const FORBIDDEN_IN_APPLICATION = [
  /^next(\/|$)/,
  /^react(-dom)?(\/|$)/,
  /^@prisma\//,
  /^prisma(\/|$)/,
  /^pg(\/|$)/,
  /^groq-sdk(\/|$)/,
  /^openai(\/|$)/,
  /^kafkajs(\/|$)/,
  /^(io)?redis(\/|$)/,
  /^@\/infrastructure\//,
  /^@\/app\//,
  /^@\/testing\//,
];

const IMPORT_PATTERN =
  /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (GENERATED_CLIENT.test(full)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(full)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

async function violations(
  directory: string,
  forbidden: readonly RegExp[],
): Promise<string[]> {
  const found: string[] = [];
  for (const file of await sourceFiles(join(ROOT, directory))) {
    for (const specifier of importsOf(file)) {
      if (forbidden.some((pattern) => pattern.test(specifier))) {
        found.push(`${relative(ROOT, file)} imports "${specifier}"`);
      }
    }
  }
  return found;
}

describe("dependency direction", () => {
  it("keeps the domain free of frameworks and infrastructure", async () => {
    expect(await violations("src/domain", FORBIDDEN_IN_DOMAIN)).toEqual([]);
  });

  it("keeps the application layer off infrastructure and the UI", async () => {
    expect(await violations("src/application", FORBIDDEN_IN_APPLICATION)).toEqual(
      [],
    );
  });

  it("finds domain sources to check, so a passing result is meaningful", async () => {
    const files = await sourceFiles(join(ROOT, "src/domain"));

    expect(files.length).toBeGreaterThan(15);
  });

  it("keeps the evaluation engine free of frameworks and infrastructure", async () => {
    expect(await violations("src/evaluation-engine", FORBIDDEN_IN_ENGINE)).toEqual(
      [],
    );
  });

  it("lets the evaluation engine depend only on the domain and application ports", async () => {
    const outside: string[] = [];
    for (const file of await sourceFiles(join(ROOT, "src/evaluation-engine"))) {
      for (const specifier of importsOf(file)) {
        if (
          specifier.startsWith("@/") &&
          !specifier.startsWith("@/domain/") &&
          !specifier.startsWith("@/application/ports/")
        ) {
          outside.push(`${relative(ROOT, file)} imports "${specifier}"`);
        }
      }
    }

    expect(outside).toEqual([]);
  });

  it("finds engine sources to check, so a passing result is meaningful", async () => {
    const files = await sourceFiles(join(ROOT, "src/evaluation-engine"));

    expect(files.length).toBeGreaterThan(5);
  });

  it("keeps the Groq SDK inside the infrastructure layer", async () => {
    const importers: string[] = [];
    for (const directory of [
      "src/domain",
      "src/application",
      "src/evaluation-engine",
    ]) {
      for (const file of await sourceFiles(join(ROOT, directory))) {
        for (const specifier of importsOf(file)) {
          if (/groq/i.test(specifier)) {
            importers.push(`${relative(ROOT, file)} imports "${specifier}"`);
          }
        }
      }
    }

    expect(importers).toEqual([]);
  });

  it("puts every Groq import in exactly one directory", async () => {
    const files = new Set<string>();
    for (const file of await sourceFiles(join(ROOT, "src"))) {
      for (const specifier of importsOf(file)) {
        if (specifier.startsWith("groq-sdk")) {
          files.add(relative(ROOT, file));
        }
      }
    }

    expect([...files]).toEqual([
      "src/infrastructure/ai/groq-llm-provider.ts",
    ]);
  });

  it("keeps the AI evaluator on the provider port rather than a vendor", async () => {
    const specifiers = importsOf(
      join(ROOT, "src/evaluation-engine/ai/ai-design-evaluator.ts"),
    );

    expect(specifiers).toContain("@/application/ports/llm-provider");
    expect(specifiers.some((entry) => /groq|openai/i.test(entry))).toBe(false);
  });

  it("keeps Prisma inside the infrastructure layer", async () => {
    const prismaImporters: string[] = [];
    for (const directory of ["src/domain", "src/application", "src/evaluation-engine"]) {
      for (const file of await sourceFiles(join(ROOT, directory))) {
        for (const specifier of importsOf(file)) {
          if (
            /prisma/i.test(specifier) ||
            specifier === "pg" ||
            GENERATED_CLIENT.test(specifier)
          ) {
            prismaImporters.push(`${relative(ROOT, file)} imports "${specifier}"`);
          }
        }
      }
    }

    expect(prismaImporters).toEqual([]);
  });

  it("lets infrastructure depend on the domain and the application ports", async () => {
    const files = await sourceFiles(join(ROOT, "src/infrastructure"));
    const specifiers = files.flatMap(importsOf);

    expect(files.length).toBeGreaterThan(5);
    expect(specifiers.some((entry) => entry.startsWith("@/domain/"))).toBe(true);
    expect(specifiers.some((entry) => entry.startsWith("@/application/"))).toBe(
      true,
    );
  });

  it("keeps the application layer off the composition root", async () => {
    const importers: string[] = [];
    for (const file of await sourceFiles(join(ROOT, "src/application"))) {
      for (const specifier of importsOf(file)) {
        if (specifier.includes("composition-root")) {
          importers.push(relative(ROOT, file));
        }
      }
    }

    expect(importers).toEqual([]);
  });

  it("detects a forbidden import when one is present", () => {
    const specifiers = ["@/domain/attempt/attempt", "@prisma/client"];

    expect(
      specifiers.filter((specifier) =>
        FORBIDDEN_IN_DOMAIN.some((pattern) => pattern.test(specifier)),
      ),
    ).toEqual(["@prisma/client"]);
  });
});
