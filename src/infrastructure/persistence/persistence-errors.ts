export abstract class PersistenceError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class UniqueConstraintError extends PersistenceError {
  readonly code = "UNIQUE_CONSTRAINT";

  constructor(
    readonly detail: { readonly target: readonly string[] },
    cause: unknown,
  ) {
    super(
      `A record with the same ${detail.target.join(", ")} already exists.`,
      { cause },
    );
  }
}

export class ForeignKeyConstraintError extends PersistenceError {
  readonly code = "FOREIGN_KEY_CONSTRAINT";

  constructor(
    readonly detail: { readonly field: string },
    cause: unknown,
  ) {
    super(`Referenced record for "${detail.field}" does not exist.`, { cause });
  }
}

export class RecordNotFoundError extends PersistenceError {
  readonly code = "RECORD_NOT_FOUND";

  constructor(
    readonly operation: string,
    cause: unknown,
  ) {
    super(`"${operation}" expected a record that no longer exists.`, { cause });
  }
}

export class PersistenceMappingError extends PersistenceError {
  readonly code = "PERSISTENCE_MAPPING";
}

interface PrismaLikeError {
  readonly code: string;
  readonly meta?: {
    readonly target?: unknown;
    readonly field_name?: unknown;
    /** For a failed nested connect: the related model that was not found. */
    readonly model?: unknown;
    readonly relation?: unknown;
  };
}

const PRISMA_ERROR_CODE = /^P\d{4}$/;

function asPrismaError(error: unknown): PrismaLikeError | null {
  // Our own errors carry a `code` too, and one of them starts with "P", so they
  // are excluded explicitly rather than by the shape of the string.
  if (
    typeof error !== "object" ||
    error === null ||
    error instanceof PersistenceError
  ) {
    return null;
  }
  const candidate = error as { code?: unknown };
  if (
    typeof candidate.code !== "string" ||
    !PRISMA_ERROR_CODE.test(candidate.code)
  ) {
    return null;
  }
  return error as PrismaLikeError;
}

function targetOf(error: PrismaLikeError): readonly string[] {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.filter((entry): entry is string => typeof entry === "string");
  }
  return typeof target === "string" ? [target] : ["unknown field"];
}

/**
 * Names the reference that could not be resolved.
 *
 * For a failed nested connect the driver reports `model` as the related model it
 * could not find and `modelName` as the model being written, so `model` is the
 * one worth naming — `modelName` would blame the wrong side of the relation.
 */
function referenceOf(error: PrismaLikeError, operationName: string): string {
  const { model, relation } = error.meta ?? {};
  if (typeof model === "string") {
    return model;
  }
  return typeof relation === "string" ? relation : operationName;
}

/**
 * What "a record was not found" means for the operation being run.
 *
 * Prisma reports both of these with P2025, and the code alone cannot separate
 * them: only the call site knows which failure its statement is capable of.
 *
 * - `MISSING_TARGET` — an update or delete whose target row is gone. That is a
 *   genuine `RecordNotFoundError`.
 * - `BROKEN_REFERENCE` — a create whose nested `connect` matched nothing. There
 *   is no target row to be absent, so the only possible cause is a reference to
 *   a parent that does not exist, which is a `ForeignKeyConstraintError` in
 *   everything but the driver's choice of code.
 */
export type MissingRecordMeaning = "MISSING_TARGET" | "BROKEN_REFERENCE";

/**
 * Translates the few driver error codes the application can act on into
 * infrastructure errors, so no Prisma error object escapes this layer. Anything
 * unrecognised is rethrown untouched rather than wrapped in a misleading type.
 */
export function translatePersistenceError(
  error: unknown,
  operationName: string,
  missingRecordMeans: MissingRecordMeaning = "MISSING_TARGET",
): never {
  const prismaError = asPrismaError(error);
  if (prismaError === null) {
    throw error;
  }

  switch (prismaError.code) {
    case "P2002":
      throw new UniqueConstraintError({ target: targetOf(prismaError) }, error);
    case "P2003":
      throw new ForeignKeyConstraintError(
        {
          field:
            typeof prismaError.meta?.field_name === "string"
              ? prismaError.meta.field_name
              : "unknown field",
        },
        error,
      );
    case "P2025":
      if (missingRecordMeans === "BROKEN_REFERENCE") {
        throw new ForeignKeyConstraintError(
          { field: referenceOf(prismaError, operationName) },
          error,
        );
      }
      throw new RecordNotFoundError(operationName, error);
    default:
      throw error;
  }
}

/** Wraps a read, update or delete: a missing record means the target is gone. */
export async function withTranslatedErrors<T>(
  operationName: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return translatePersistenceError(error, operationName, "MISSING_TARGET");
  }
}

/**
 * Wraps a statement that only creates rows, where a missing record can only be a
 * nested `connect` that resolved to nothing.
 */
export async function withTranslatedCreateErrors<T>(
  operationName: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return translatePersistenceError(error, operationName, "BROKEN_REFERENCE");
  }
}
