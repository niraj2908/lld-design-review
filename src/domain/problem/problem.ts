import { DuplicateEntityError, InvalidProblemError } from "../shared/errors";
import { isBlank } from "../shared/text";
import type { SubmissionFormatType } from "../submission/submission-format-type";
import type { Requirement } from "./requirement";
import type { Rubric } from "./rubric";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ProblemProps {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context: string;
  readonly constraints: readonly string[];
  readonly requirements: readonly Requirement[];
  readonly acceptedSubmissionFormats: readonly SubmissionFormatType[];
  readonly rubric: Rubric;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Problem {
  private constructor(private readonly props: ProblemProps) {}

  static create(props: ProblemProps): Problem {
    requireField(props.id, "id");
    requireField(props.title, "title");
    requireField(props.description, "description");

    if (!SLUG_PATTERN.test(props.slug)) {
      throw new InvalidProblemError(
        `Problem slug "${props.slug}" must be lower-case kebab-case; it is used as the problem URL.`,
        { field: "slug" },
      );
    }

    if (props.requirements.length === 0) {
      throw new InvalidProblemError(
        "A problem must declare at least one explicit requirement; evaluation reasons from requirements.",
        { field: "requirements" },
      );
    }

    if (props.acceptedSubmissionFormats.length === 0) {
      throw new InvalidProblemError(
        "A problem must accept at least one submission format.",
        { field: "acceptedSubmissionFormats" },
      );
    }

    if (props.rubric.criteria.length === 0) {
      throw new InvalidProblemError(
        "A problem rubric must declare at least one criterion.",
        { field: "rubric" },
      );
    }

    assertUnique(
      props.requirements.map((requirement) => requirement.id),
      "Requirement",
      "id",
    );
    assertUnique(
      props.requirements.map((requirement) => requirement.code),
      "Requirement",
      "code",
    );
    assertUnique(
      props.rubric.criteria.map((criterion) => criterion.criterion),
      "RubricCriterion",
      "criterion",
    );

    const foreign = props.requirements.find(
      (requirement) => requirement.problemId !== props.id,
    );
    if (foreign !== undefined) {
      throw new InvalidProblemError(
        `Requirement "${foreign.id}" belongs to problem "${foreign.problemId}", not "${props.id}".`,
        { field: "requirements" },
      );
    }

    if (props.version < 1 || !Number.isInteger(props.version)) {
      throw new InvalidProblemError(
        "Problem version must be a positive integer.",
        { field: "version" },
      );
    }

    return new Problem(props);
  }

  get id(): string {
    return this.props.id;
  }

  get slug(): string {
    return this.props.slug;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get context(): string {
    return this.props.context;
  }

  get constraints(): readonly string[] {
    return this.props.constraints;
  }

  get requirements(): readonly Requirement[] {
    return this.props.requirements;
  }

  get requirementIds(): readonly string[] {
    return this.props.requirements.map((requirement) => requirement.id);
  }

  get rubric(): Rubric {
    return this.props.rubric;
  }

  get acceptedSubmissionFormats(): readonly SubmissionFormatType[] {
    return this.props.acceptedSubmissionFormats;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  hasRequirement(requirementId: string): boolean {
    return this.props.requirements.some(
      (requirement) => requirement.id === requirementId,
    );
  }

  requirementByCode(code: string): Requirement | undefined {
    return this.props.requirements.find(
      (requirement) => requirement.code === code,
    );
  }

  accepts(formatType: SubmissionFormatType): boolean {
    return this.props.acceptedSubmissionFormats.includes(formatType);
  }

  toSnapshot(): ProblemProps {
    return this.props;
  }
}

function requireField(value: string, field: string): void {
  if (isBlank(value)) {
    throw new InvalidProblemError(`Problem "${field}" must not be empty.`, {
      field,
    });
  }
}

function assertUnique(
  values: readonly string[],
  entity: string,
  field: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new DuplicateEntityError({ entity, field, value });
    }
    seen.add(value);
  }
}
