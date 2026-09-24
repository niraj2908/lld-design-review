import { isBlank } from "../shared/text";
import type {
  ValidationIssue,
  ValidationIssueCode,
  ValidationResult,
  ValidationSeverity,
} from "../shared/validation";
import { buildDesignElementIndex } from "./design-element-index";
import type { DesignElementIndex } from "./design-element-index";
import { DEFAULT_DESIGN_LIMITS } from "./design-limits";
import type { DesignLimits } from "./design-limits";
import { isRelationshipType } from "./relationship-type";
import { isDesignEmpty } from "./structured-design";
import type { StructuredDesign } from "./structured-design";

export interface DesignValidationContext {
  /** Requirement ids that belong to the problem the design answers. */
  readonly requirementIds: readonly string[];
  readonly limits?: DesignLimits;
}

class IssueCollector {
  private readonly issues: ValidationIssue[] = [];

  add(
    code: ValidationIssueCode,
    path: string,
    message: string,
    severity: ValidationSeverity = "ERROR",
  ): void {
    this.issues.push({ code, path, message, severity });
  }

  result(): ValidationResult {
    return { issues: this.issues };
  }
}

/**
 * Deterministic structural validation only.
 *
 * It never asks whether a particular pattern, interface or abstraction "should"
 * be present: multiple valid designs must pass. Subjective design quality is
 * the evaluator's concern, not this function's.
 */
export function validateStructuredDesign(
  design: StructuredDesign,
  context: DesignValidationContext,
): ValidationResult {
  const limits = context.limits ?? DEFAULT_DESIGN_LIMITS;
  const collector = new IssueCollector();

  checkCollectionSizes(design, limits, collector);

  if (isDesignEmpty(design)) {
    collector.add(
      "DESIGN_EMPTY",
      "design",
      "A design must contain at least one class or interface.",
    );
    return collector.result();
  }

  checkClasses(design, limits, collector);
  checkInterfaces(design, limits, collector);
  checkNameCollisions(design, collector);

  const elements = buildDesignElementIndex(design);

  checkRelationships(design, elements, limits, collector);
  checkDecisions(design, limits, collector);
  checkEdgeCases(design, limits, collector);
  checkRequirementMappings(design, elements, context, collector);

  return collector.result();
}

function checkCollectionSizes(
  design: StructuredDesign,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  const collections: readonly [string, number, number][] = [
    ["classes", design.classes.length, limits.maxClasses],
    ["interfaces", design.interfaces.length, limits.maxInterfaces],
    ["relationships", design.relationships.length, limits.maxRelationships],
    ["decisions", design.decisions.length, limits.maxDecisions],
    ["edgeCases", design.edgeCases.length, limits.maxEdgeCases],
    [
      "requirementMappings",
      design.requirementMappings.length,
      limits.maxRequirementMappings,
    ],
  ];

  for (const [name, size, max] of collections) {
    if (size > max) {
      collector.add(
        "COLLECTION_LIMIT_EXCEEDED",
        name,
        `"${name}" holds ${size} entries but the limit is ${max}.`,
      );
    }
  }
}

function checkName(
  value: string,
  path: string,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  if (value.trim().length > limits.maxNameLength) {
    collector.add(
      "NAME_TOO_LONG",
      path,
      `Name exceeds ${limits.maxNameLength} characters.`,
    );
  }
}

function checkFreeText(
  value: string,
  path: string,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  if (value.trim().length > limits.maxTextLength) {
    collector.add(
      "TEXT_TOO_LONG",
      path,
      `Text exceeds ${limits.maxTextLength} characters.`,
    );
  }
}

function checkClasses(
  design: StructuredDesign,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  const seen = new Set<string>();

  design.classes.forEach((definition, index) => {
    const path = `classes[${index}]`;

    if (isBlank(definition.name)) {
      collector.add(
        "CLASS_NAME_REQUIRED",
        `${path}.name`,
        "Every class needs a name.",
      );
    } else {
      const name = definition.name.trim();
      checkName(name, `${path}.name`, limits, collector);
      if (seen.has(name)) {
        collector.add(
          "DUPLICATE_CLASS_NAME",
          `${path}.name`,
          `Class name "${name}" is declared more than once.`,
        );
      }
      seen.add(name);
    }

    if (isBlank(definition.responsibility)) {
      collector.add(
        "CLASS_RESPONSIBILITY_REQUIRED",
        `${path}.responsibility`,
        "Every class must state what it is responsible for.",
      );
    } else {
      checkFreeText(
        definition.responsibility,
        `${path}.responsibility`,
        limits,
        collector,
      );
    }

    definition.attributes.forEach((attribute, attributeIndex) => {
      if (isBlank(attribute.name)) {
        collector.add(
          "CLASS_ATTRIBUTE_NAME_REQUIRED",
          `${path}.attributes[${attributeIndex}].name`,
          "Every attribute needs a name.",
        );
      }
    });

    definition.methods.forEach((method, methodIndex) => {
      if (isBlank(method.name)) {
        collector.add(
          "CLASS_METHOD_NAME_REQUIRED",
          `${path}.methods[${methodIndex}].name`,
          "Every method needs a name.",
        );
      }
    });
  });
}

function checkInterfaces(
  design: StructuredDesign,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  const seen = new Set<string>();

  design.interfaces.forEach((definition, index) => {
    const path = `interfaces[${index}]`;

    if (isBlank(definition.name)) {
      collector.add(
        "INTERFACE_NAME_REQUIRED",
        `${path}.name`,
        "Every interface needs a name.",
      );
    } else {
      const name = definition.name.trim();
      checkName(name, `${path}.name`, limits, collector);
      if (seen.has(name)) {
        collector.add(
          "DUPLICATE_INTERFACE_NAME",
          `${path}.name`,
          `Interface name "${name}" is declared more than once.`,
        );
      }
      seen.add(name);
    }

    if (isBlank(definition.responsibility)) {
      collector.add(
        "INTERFACE_RESPONSIBILITY_REQUIRED",
        `${path}.responsibility`,
        "Every interface must state what it is responsible for.",
      );
    } else {
      checkFreeText(
        definition.responsibility,
        `${path}.responsibility`,
        limits,
        collector,
      );
    }

    definition.methods.forEach((method, methodIndex) => {
      if (isBlank(method.name)) {
        collector.add(
          "INTERFACE_METHOD_NAME_REQUIRED",
          `${path}.methods[${methodIndex}].name`,
          "Every interface method needs a name.",
        );
      }
    });
  });
}

function checkNameCollisions(
  design: StructuredDesign,
  collector: IssueCollector,
): void {
  const classNames = new Set(
    design.classes
      .map((definition) => definition.name.trim())
      .filter((name) => name.length > 0),
  );

  design.interfaces.forEach((definition, index) => {
    const name = definition.name.trim();
    if (name.length > 0 && classNames.has(name)) {
      collector.add(
        "ELEMENT_NAME_COLLISION",
        `interfaces[${index}].name`,
        `"${name}" is used by both a class and an interface; relationship and evidence references would be ambiguous.`,
      );
    }
  });
}

function checkRelationships(
  design: StructuredDesign,
  elements: DesignElementIndex,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  const seen = new Set<string>();

  design.relationships.forEach((relationship, index) => {
    const path = `relationships[${index}]`;
    const source = relationship.source?.trim() ?? "";
    const target = relationship.target?.trim() ?? "";

    if (!isRelationshipType(relationship.type)) {
      collector.add(
        "UNSUPPORTED_RELATIONSHIP_TYPE",
        `${path}.type`,
        `Relationship type "${String(relationship.type)}" is not supported.`,
      );
    }

    if (source.length === 0) {
      collector.add(
        "RELATIONSHIP_SOURCE_REQUIRED",
        `${path}.source`,
        "A relationship needs a source element.",
      );
    } else if (!elements.has(source)) {
      collector.add(
        "UNKNOWN_RELATIONSHIP_SOURCE",
        `${path}.source`,
        `Relationship source "${source}" is not a class or interface in this design.`,
      );
    }

    if (target.length === 0) {
      collector.add(
        "RELATIONSHIP_TARGET_REQUIRED",
        `${path}.target`,
        "A relationship needs a target element.",
      );
    } else if (!elements.has(target)) {
      collector.add(
        "UNKNOWN_RELATIONSHIP_TARGET",
        `${path}.target`,
        `Relationship target "${target}" is not a class or interface in this design.`,
      );
    }

    if (relationship.rationale !== undefined) {
      checkFreeText(
        relationship.rationale,
        `${path}.rationale`,
        limits,
        collector,
      );
    }

    const sourceKind = elements.kindOf(source);
    const targetKind = elements.kindOf(target);

    if (relationship.type === "IMPLEMENTATION") {
      if (sourceKind === "INTERFACE") {
        collector.add(
          "INVALID_IMPLEMENTATION_SOURCE",
          `${path}.source`,
          `"${source}" is an interface; an interface extends another interface rather than implementing it.`,
        );
      }
      if (targetKind === "CLASS") {
        collector.add(
          "INVALID_IMPLEMENTATION_TARGET",
          `${path}.target`,
          `"${target}" is a class; an IMPLEMENTATION relationship must target an interface.`,
        );
      }
    }

    if (
      relationship.type === "INHERITANCE" &&
      sourceKind !== undefined &&
      targetKind !== undefined &&
      sourceKind !== targetKind
    ) {
      collector.add(
        "INVALID_INHERITANCE_ENDPOINT",
        path,
        `INHERITANCE must connect two classes or two interfaces, but "${source}" is a ${sourceKind} and "${target}" is a ${targetKind}.`,
      );
    }

    if (
      source.length > 0 &&
      source === target &&
      (relationship.type === "INHERITANCE" ||
        relationship.type === "IMPLEMENTATION")
    ) {
      collector.add(
        "INVALID_SELF_RELATIONSHIP",
        path,
        `"${source}" cannot ${relationship.type === "INHERITANCE" ? "inherit from" : "implement"} itself.`,
      );
    }

    const fingerprint = `${source}->${target}:${String(relationship.type)}`;
    if (seen.has(fingerprint)) {
      collector.add(
        "DUPLICATE_RELATIONSHIP",
        path,
        `Relationship ${fingerprint} is declared more than once.`,
      );
    }
    seen.add(fingerprint);
  });
}

function checkDecisions(
  design: StructuredDesign,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  design.decisions.forEach((decision, index) => {
    const path = `decisions[${index}]`;
    const fields: readonly [keyof typeof decision, string][] = [
      ["decision", "what was decided"],
      ["rationale", "why it was decided"],
      ["tradeoff", "what it costs"],
    ];

    for (const [field, description] of fields) {
      const value = decision[field];
      if (isBlank(value)) {
        collector.add(
          "DECISION_FIELD_REQUIRED",
          `${path}.${field}`,
          `A design decision must record ${description}.`,
        );
      } else {
        checkFreeText(value, `${path}.${field}`, limits, collector);
      }
    }
  });
}

function checkEdgeCases(
  design: StructuredDesign,
  limits: DesignLimits,
  collector: IssueCollector,
): void {
  design.edgeCases.forEach((edgeCase, index) => {
    const path = `edgeCases[${index}]`;
    const fields: readonly [keyof typeof edgeCase, string][] = [
      ["description", "the situation"],
      ["expectedBehavior", "the expected behaviour"],
    ];

    for (const [field, description] of fields) {
      const value = edgeCase[field];
      if (isBlank(value)) {
        collector.add(
          "EDGE_CASE_FIELD_REQUIRED",
          `${path}.${field}`,
          `An edge case must record ${description}.`,
        );
      } else {
        checkFreeText(value, `${path}.${field}`, limits, collector);
      }
    }
  });
}

function checkRequirementMappings(
  design: StructuredDesign,
  elements: DesignElementIndex,
  context: DesignValidationContext,
  collector: IssueCollector,
): void {
  const requirementIds = new Set(context.requirementIds);

  design.requirementMappings.forEach((mapping, index) => {
    const path = `requirementMappings[${index}]`;

    if (!requirementIds.has(mapping.requirementId)) {
      collector.add(
        "UNKNOWN_REQUIREMENT",
        `${path}.requirementId`,
        `Requirement "${mapping.requirementId}" does not belong to this problem.`,
      );
    }

    if (mapping.references.length === 0) {
      collector.add(
        "REQUIREMENT_MAPPING_REFERENCE_REQUIRED",
        `${path}.references`,
        "A requirement mapping must point at least at one design element.",
      );
    }

    mapping.references.forEach((reference, referenceIndex) => {
      if (!elements.has(reference.entity)) {
        collector.add(
          "UNKNOWN_EVIDENCE_ENTITY",
          `${path}.references[${referenceIndex}].entity`,
          `"${reference.entity}" is not a class or interface in this design.`,
        );
      }
    });
  });
}
