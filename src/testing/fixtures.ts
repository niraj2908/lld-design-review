import type { StructuredDesign } from "@/domain/design/structured-design";
import { Problem } from "@/domain/problem/problem";
import type { Requirement } from "@/domain/problem/requirement";
import type { Rubric } from "@/domain/problem/rubric";
import { STRUCTURED_DESIGN } from "@/domain/submission/submission-format-type";

export const LEARNER_ID = "learner_seed";
export const PARKING_LOT_PROBLEM_ID = "prb_parking_lot";

export const PARKING_LOT_REQUIREMENTS: readonly Requirement[] = [
  {
    id: "req_pl_01",
    problemId: PARKING_LOT_PROBLEM_ID,
    code: "PL-REQ-01",
    title: "Compatible spot allocation",
    description:
      "A vehicle must be assigned to a parking spot compatible with its type.",
    priority: "MUST",
  },
  {
    id: "req_pl_02",
    problemId: PARKING_LOT_PROBLEM_ID,
    code: "PL-REQ-02",
    title: "Parking fee calculation",
    description: "A completed parking session must produce a fee.",
    priority: "MUST",
  },
];

export const PARKING_LOT_RUBRIC: Rubric = {
  version: "parking-lot-v1",
  criteria: [
    {
      criterion: "REQUIREMENT_UNDERSTANDING",
      weight: 0.25,
      guidance: "Does the design address the stated requirements?",
    },
    {
      criterion: "RESPONSIBILITY",
      weight: 0.25,
      guidance: "Is each responsibility owned by a sensible element?",
    },
    {
      criterion: "EXTENSIBILITY",
      weight: 0.25,
      guidance: "Can the stated variation points change independently?",
    },
    {
      criterion: "EDGE_CASES",
      weight: 0.25,
      guidance: "Are the relevant edge cases acknowledged?",
    },
  ],
};

export function parkingLotProblem(
  overrides: Partial<Parameters<typeof Problem.create>[0]> = {},
): Problem {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  return Problem.create({
    id: PARKING_LOT_PROBLEM_ID,
    slug: "parking-lot",
    title: "Parking Lot",
    description:
      "Design the classes behind a multi-level parking lot that issues tickets and charges fees.",
    context:
      "A single site with several levels, mixed spot sizes and a paid exit barrier.",
    constraints: [
      "Allocation policy may change per site.",
      "Pricing policy may change independently of allocation.",
    ],
    requirements: PARKING_LOT_REQUIREMENTS,
    acceptedSubmissionFormats: [STRUCTURED_DESIGN],
    rubric: PARKING_LOT_RUBRIC,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

/**
 * One valid answer, not the answer. Tests must never treat this design as a
 * reference solution other designs are scored against.
 */
export function validParkingLotDesign(): StructuredDesign {
  return {
    classes: [
      {
        id: "cls_parking_lot",
        name: "ParkingLot",
        responsibility: "Owns levels and coordinates parking and exit flows.",
        attributes: [{ name: "levels", type: "Level[]" }],
        methods: [
          { name: "park", signature: "park(vehicle: Vehicle): Ticket" },
          { name: "exit", signature: "exit(ticket: Ticket): Money" },
        ],
      },
      {
        id: "cls_ticket",
        name: "Ticket",
        responsibility: "Records where and when a vehicle was parked.",
        attributes: [
          { name: "spotId", type: "string" },
          { name: "issuedAt", type: "Date" },
        ],
        methods: [],
      },
      {
        id: "cls_size_pricing",
        name: "SizeBasedPricing",
        responsibility: "Prices a session by spot size and duration.",
        attributes: [],
        methods: [{ name: "calculateFee" }],
      },
    ],
    interfaces: [
      {
        id: "itf_pricing_strategy",
        name: "PricingStrategy",
        responsibility: "Turns a finished parking session into a fee.",
        methods: [
          { name: "calculateFee", signature: "calculateFee(ticket, exitAt)" },
        ],
      },
    ],
    relationships: [
      { source: "ParkingLot", target: "Ticket", type: "COMPOSITION" },
      { source: "ParkingLot", target: "PricingStrategy", type: "DEPENDENCY" },
      {
        source: "SizeBasedPricing",
        target: "PricingStrategy",
        type: "IMPLEMENTATION",
      },
    ],
    decisions: [
      {
        decision: "Keep pricing behind PricingStrategy.",
        rationale: "The brief says pricing may change independently.",
        tradeoff: "An extra indirection for sites with one fixed tariff.",
      },
    ],
    edgeCases: [
      {
        description: "No compatible spot is free.",
        expectedBehavior: "Parking is refused without issuing a ticket.",
      },
    ],
    requirementMappings: [
      {
        requirementId: "req_pl_01",
        references: [{ entity: "ParkingLot", field: "methods", value: "park" }],
      },
      {
        requirementId: "req_pl_02",
        references: [{ entity: "PricingStrategy" }],
      },
    ],
  };
}
