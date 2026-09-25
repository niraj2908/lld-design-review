import type { StructuredDesign } from "@/domain/design/structured-design";
import type { AIReview } from "@/evaluation-engine/ai/ai-response-schema";

/**
 * Benchmark G's two-attempt scenario, shared by `regression-evolution.test.ts`
 * (the real assertions) and `run-benchmarks.ts` (the human-readable summary), so
 * the two never drift into describing different fixtures under the same name.
 *
 * Attempt 2 genuinely fixes attempt 1's one real issue (`ParkingLot` doing two
 * jobs, split into `SpotAllocator` and `ExitGate`) and genuinely introduces a
 * different one (`PricingStrategyFactory`, unjustified indirection over a single
 * pricing implementation) — see `docs/EVALUATION_BENCHMARK.md#regression-design`.
 */
export const regressionAttempt1Design: StructuredDesign = {
  classes: [
    {
      id: "c1",
      name: "ParkingLot",
      responsibility: "Owns levels, coordinates parking, and computes the exit fee directly.",
      attributes: [],
      methods: [{ name: "park" }, { name: "exit" }],
    },
    {
      id: "c2",
      name: "Ticket",
      responsibility: "Records where and when a vehicle was parked.",
      attributes: [{ name: "spotId", type: "string" }],
      methods: [],
    },
  ],
  interfaces: [],
  relationships: [{ source: "ParkingLot", target: "Ticket", type: "COMPOSITION" }],
  decisions: [
    {
      decision: "Keep fee calculation inside ParkingLot for now.",
      rationale: "Only one tariff exists today.",
      tradeoff: "ParkingLot will need to change if pricing rules ever diverge from allocation.",
    },
  ],
  edgeCases: [{ description: "No compatible spot is free.", expectedBehavior: "Parking is refused; no ticket is issued." }],
  requirementMappings: [
    { requirementId: "req_pl_01", references: [{ entity: "ParkingLot", field: "methods", value: "park" }] },
    { requirementId: "req_pl_02", references: [{ entity: "ParkingLot", field: "methods", value: "exit" }] },
  ],
};

export const regressionAttempt2Design: StructuredDesign = {
  classes: [
    {
      id: "c1",
      name: "SpotAllocator",
      responsibility: "Allocates a compatible spot and issues a ticket.",
      attributes: [],
      methods: [{ name: "park" }],
    },
    {
      id: "c2",
      name: "ExitGate",
      responsibility: "Handles vehicle exit and requests the fee from the pricing strategy factory.",
      attributes: [],
      methods: [{ name: "exit" }],
    },
    {
      id: "c3",
      name: "DefaultPricingStrategy",
      responsibility: "Computes a flat per-hour fee.",
      attributes: [],
      methods: [{ name: "calculateFee" }],
    },
    {
      id: "c4",
      name: "PricingStrategyFactory",
      responsibility: "Creates a pricing strategy instance.",
      attributes: [],
      methods: [{ name: "create" }],
    },
    {
      id: "c5",
      name: "Ticket",
      responsibility: "Records where and when a vehicle was parked.",
      attributes: [{ name: "spotId", type: "string" }],
      methods: [],
    },
  ],
  interfaces: [
    { id: "i1", name: "IPricingStrategy", responsibility: "Computes the fee for a completed session.", methods: [{ name: "calculateFee" }] },
    { id: "i2", name: "IPricingStrategyFactory", responsibility: "Creates an IPricingStrategy.", methods: [{ name: "create" }] },
  ],
  relationships: [
    { source: "SpotAllocator", target: "Ticket", type: "COMPOSITION" },
    { source: "ExitGate", target: "IPricingStrategyFactory", type: "DEPENDENCY" },
    { source: "DefaultPricingStrategy", target: "IPricingStrategy", type: "IMPLEMENTATION" },
    { source: "PricingStrategyFactory", target: "IPricingStrategyFactory", type: "IMPLEMENTATION" },
  ],
  decisions: [
    {
      decision: "Split allocation and exit handling; add a pricing strategy and a factory for it.",
      rationale: "Keeps fee logic out of allocation and lets pricing construction vary.",
      tradeoff: "Two new interfaces and a factory for a single pricing implementation.",
    },
  ],
  edgeCases: [{ description: "No compatible spot is free.", expectedBehavior: "Allocation is refused; no ticket is issued." }],
  requirementMappings: [
    { requirementId: "req_pl_01", references: [{ entity: "SpotAllocator", field: "methods", value: "park" }] },
    { requirementId: "req_pl_02", references: [{ entity: "ExitGate", field: "methods", value: "exit" }] },
  ],
};

export const regressionAttempt1Review: AIReview = {
  criteria: [
    {
      criterion: "RESPONSIBILITY",
      assessment: "NEEDS_IMPROVEMENT",
      evidence: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      concern: "ParkingLot both coordinates parking and computes the fee — two responsibilities the brief treats as independent.",
      suggestion: "Extract fee calculation from ParkingLot.",
      confidence: 0.7,
    },
    {
      criterion: "ABSTRACTION",
      assessment: "ADEQUATE",
      evidence: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      concern: "No pricing seam yet, which is proportionate: only one tariff exists today.",
      confidence: 0.6,
    },
  ],
  strengths: ["Both requirements carry explicit design evidence."],
  priorityImprovements: [
    {
      criterion: "RESPONSIBILITY",
      priority: "P2",
      what: "ParkingLot computes fees itself, alongside allocation.",
      where: [{ entity: "ParkingLot", field: "methods", value: "exit" }],
      why: "Pricing may change independently of allocation per the brief.",
      reconsider: "Extract a pricing collaborator from ParkingLot.",
    },
  ],
  summary: "Workable, but ParkingLot is carrying two responsibilities.",
};

export const regressionAttempt2Review: AIReview = {
  criteria: [
    {
      criterion: "RESPONSIBILITY",
      assessment: "STRONG",
      evidence: [{ entity: "SpotAllocator", field: "responsibility", value: "Allocates a compatible spot and issues a ticket." }],
      confidence: 0.75,
    },
    {
      criterion: "ABSTRACTION",
      assessment: "NEEDS_IMPROVEMENT",
      evidence: [{ entity: "PricingStrategyFactory", field: "responsibility", value: "Creates a pricing strategy instance." }],
      concern: "A factory was added for a single pricing implementation with no stated need to construct it dynamically.",
      suggestion: "Drop the factory; construct DefaultPricingStrategy directly.",
      confidence: 0.65,
    },
  ],
  strengths: ["Fee calculation now sits behind its own abstraction, separate from allocation."],
  priorityImprovements: [
    {
      criterion: "ABSTRACTION",
      priority: "P2",
      what: "PricingStrategyFactory adds indirection with only one implementation.",
      where: [{ entity: "PricingStrategyFactory", field: "responsibility", value: "Creates a pricing strategy instance." }],
      why: "Nothing in the brief calls for swapping pricing construction at runtime.",
      reconsider: "Remove the factory layer.",
    },
  ],
  summary: "Responsibility is cleaner, but the new factory is not yet justified.",
};
