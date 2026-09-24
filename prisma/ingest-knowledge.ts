import { createPrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";
import { createKnowledgeServices } from "@/infrastructure/composition-root";
import { KNOWLEDGE_DOCUMENTS } from "@/infrastructure/knowledge/seed/knowledge-catalogue";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env, then run `npm run db:up`.",
    );
  }

  const prisma = createPrismaClient({ connectionString });
  try {
    const knowledge = createKnowledgeServices(prisma);
    const result = await knowledge.ingest.execute(KNOWLEDGE_DOCUMENTS);

    process.stdout.write(
      `Ingested ${result.documents} knowledge documents as ${result.chunks} chunks ` +
        `using ${knowledge.embeddings.name} (${result.model}, ${result.dimensions} dimensions).\n`,
    );
    if (knowledge.embeddings.name === "hashing-local") {
      process.stdout.write(
        "No embedding service is configured, so these vectors are lexical rather than semantic. Set EMBEDDING_API_KEY and re-run to replace them.\n",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Knowledge ingestion failed: ${String(error)}\n`);
  process.exitCode = 1;
});
