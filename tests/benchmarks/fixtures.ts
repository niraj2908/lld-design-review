import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Problem } from "@/domain/problem/problem";
import type { AIReview } from "@/evaluation-engine/ai/ai-response-schema";
import {
  parkingLotProblem,
  validParkingLotDesign,
} from "@/testing/fixtures";

/**
 * The M10 benchmark suite: a small, curated set of Parking Lot designs chosen to
 * exercise a specific, named claim about evaluator behaviour — never to prove the
 * evaluator "is accurate" in general. See `docs/EVALUATION_BENCHMARK.md` for the
 * philosophy and how each case is meant to be read.
 *
 * Every case reuses `parkingLotProblem()` from `@/testing/fixtures` — the same
 * problem, same two requirements, every other test in this codebase already
 * evaluates against — rather than inventing a parallel problem just for
 * benchmarking. `validParkingLotDesign()` is reused directly as the strong-design
 * case for the same reason: it is already the project's own "one valid answer,
 * not the answer" fixture.
 */
export const BENCHMARK_CATEGORIES = [
  "STRONG",
  "WEAK",
  "VALID_ALTERNATIVE",
  "OVER_ENGINEERED",
  "MISSING_REQUIREMENT",
  "EDGE_CASE_HEAVY",
] as const;

export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];

export interface BenchmarkCase {
  readonly id: string;
  readonly problem: Problem;
  readonly category: BenchmarkCategory;
  /** Why this case exists — what claim about evaluator behaviour it is meant to test. */
  readonly intent: string;
  readonly design: StructuredDesign;
  /** Facts a reader should expect the deterministic evaluator to report, in prose. */
  readonly expectedDeterministicFindings: readonly string[];
  /** Judgements a reasonable judge could make, in prose — never a required exact wording. */
  readonly expectedSemanticFindings: readonly string[];
  readonly expectedStrengths: readonly string[];
  /** Honest limitations or accepted costs of this design, stated rather than hidden. */
  readonly knownTradeoffs: readonly string[];
  /**
   * A representative, hand-written judge answer for this case, used to script
   * `FakeLLMProvider` in the semantic and hybrid benchmarks. It is one plausible
   * judgement, not the judgement — a different but equally reasonable answer would
   * not make the benchmark fail, because the benchmark asserts behaviour
   * (grounding held, deterministic facts unmoved, no fabricated evidence), not
   * this exact text.
   */
  readonly mockAiReview: AIReview;
}

const problem = parkingLotProblem();

/**
 * Benchmark A — Strong design.
 *
 * Reused verbatim from the shared fixtures rather than duplicated: it already
 * covers both requirements explicitly, states a rationale and a trade-off for
 * its one seam, and records an edge case. Nothing here is benchmark-specific.
 */
const strongDesign: BenchmarkCase = {
  id: "strong-design",
  problem,
  category: "STRONG",
  intent:
    "A well-structured solution should read as strong on structure and receive no manufactured semantic concerns.",
  design: validParkingLotDesign(),
  expectedDeterministicFindings: [
    "Both requirements carry an explicit mapping to a real design element.",
    "Every class and interface states a responsibility and every reference resolves.",
    "One design decision and one edge case are recorded.",
  ],
  expectedSemanticFindings: [
    "The PricingStrategy seam is justified by the brief's stated variation point (pricing changes independently of allocation).",
    "No responsibility, cohesion or coupling concern is warranted by this design.",
  ],
  expectedStrengths: [
    "Requirement coverage is explicit and traceable.",
    "The one abstraction present has a stated rationale and trade-off.",
  ],
  knownTradeoffs: [
    "Three classes and one interface is a small surface; a larger lot with more pricing policies is not modelled.",
  ],
  mockAiReview: {
    criteria: [
      {
        criterion: "ABSTRACTION",
        assessment: "STRONG",
        evidence: [
          { entity: "PricingStrategy", field: "responsibility", value: "Turns a finished parking session into a fee." },
        ],
        confidence: 0.8,
      },
      {
        criterion: "RESPONSIBILITY",
        assessment: "ADEQUATE",
        evidence: [
          { entity: "ParkingLot", field: "responsibility", value: "Owns levels and coordinates parking and exit flows." },
        ],
        confidence: 0.7,
      },
    ],
    strengths: [
      "Pricing is expressed as a contract with a stated rationale, not a guess.",
      "Both requirements are mapped to the elements that actually satisfy them.",
    ],
    priorityImprovements: [],
    summary: "A structurally sound decomposition with one justified seam.",
  },
};

/**
 * Benchmark B — Weak design.
 *
 * A god class (`ParkingLotManager`) owns allocation, pricing, ticketing and
 * persistence at once, exposes mutable state directly, and depends on a
 * concrete infrastructure class instead of an abstraction. It is deliberately
 * still structurally *valid* — every reference resolves, every element has a
 * responsibility string, both requirements are mapped — so the weakness is
 * something only a semantic judge can see, which is the point: the deterministic
 * evaluator cannot and must not manufacture a structural complaint just because
 * a design happens to be a bad idea.
 */
const weakDesign: BenchmarkCase = {
  id: "weak-design",
  problem,
  category: "WEAK",
  intent:
    "A god class with direct infrastructure coupling should be structurally valid (nothing for the deterministic evaluator to flag) while a semantic judge identifies real, evidence-backed issues.",
  design: {
    classes: [
      {
        id: "cls_manager",
        name: "ParkingLotManager",
        responsibility:
          "Handles vehicle entry, spot allocation, fee calculation, ticket printing, payment processing and revenue reporting for the whole lot.",
        attributes: [
          { name: "spots", type: "Spot[]" },
          { name: "tickets", type: "Ticket[]" },
          { name: "totalRevenue", type: "number" },
        ],
        methods: [
          { name: "park" },
          { name: "calculateFee" },
          { name: "printTicket" },
          { name: "processPayment" },
          { name: "generateRevenueReport" },
        ],
      },
      {
        id: "cls_database",
        name: "SqlDatabase",
        responsibility: "Stores rows for the parking lot schema.",
        attributes: [],
        methods: [{ name: "execute" }],
      },
    ],
    interfaces: [],
    relationships: [
      { source: "ParkingLotManager", target: "SqlDatabase", type: "DEPENDENCY" },
    ],
    decisions: [],
    edgeCases: [],
    requirementMappings: [
      {
        requirementId: "req_pl_01",
        references: [{ entity: "ParkingLotManager", field: "methods", value: "park" }],
      },
      {
        requirementId: "req_pl_02",
        references: [{ entity: "ParkingLotManager", field: "methods", value: "calculateFee" }],
      },
    ],
  },
  expectedDeterministicFindings: [
    "Both requirements are technically mapped, so deterministic requirement coverage is adequate — mapping to a god class is a fact determinism cannot see past.",
    "No design decisions were recorded.",
    "No edge cases were recorded.",
  ],
  expectedSemanticFindings: [
    "ParkingLotManager carries several unrelated responsibilities (RESPONSIBILITY/COHESION).",
    "ParkingLotManager depends directly on a concrete SqlDatabase rather than an abstraction (COUPLING).",
    "totalRevenue is exposed as a plain attribute with no invariant protecting it (ENCAPSULATION).",
  ],
  expectedStrengths: [],
  knownTradeoffs: [
    "The design is intentionally poor; there is nothing here to defend as a reasonable choice.",
  ],
  mockAiReview: {
    criteria: [
      {
        criterion: "RESPONSIBILITY",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [
          {
            entity: "ParkingLotManager",
            field: "responsibility",
            value: "Handles vehicle entry, spot allocation, fee calculation, ticket printing, payment processing and revenue reporting for the whole lot.",
          },
        ],
        concern: "One class owns allocation, pricing, ticketing, payment and reporting — five responsibilities with no reason to change together.",
        suggestion: "Split allocation, pricing and payment/reporting into collaborators with one job each.",
        confidence: 0.75,
      },
      {
        criterion: "COUPLING",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [
          { entity: "ParkingLotManager", field: "relationships", value: "SqlDatabase" },
        ],
        concern: "ParkingLotManager depends directly on a concrete SqlDatabase, so persistence changes force this class to change too.",
        suggestion: "Depend on a repository abstraction instead of a concrete storage class.",
        confidence: 0.7,
      },
      {
        criterion: "ENCAPSULATION",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [
          { entity: "ParkingLotManager", field: "attributes", value: "totalRevenue" },
        ],
        concern: "totalRevenue is a plain attribute with no method protecting how it changes.",
        confidence: 0.6,
      },
    ],
    strengths: [],
    priorityImprovements: [
      {
        criterion: "RESPONSIBILITY",
        priority: "P1",
        what: "ParkingLotManager concentrates five unrelated responsibilities.",
        where: [
          {
            entity: "ParkingLotManager",
            field: "responsibility",
            value: "Handles vehicle entry, spot allocation, fee calculation, ticket printing, payment processing and revenue reporting for the whole lot.",
          },
        ],
        why: "A class that changes for five unrelated reasons is expensive to change safely.",
        reconsider: "Extract at least a pricing collaborator and a payment collaborator.",
      },
    ],
    summary: "The design compiles and covers both requirements, but concentrates responsibility and couples directly to infrastructure.",
  },
};

/**
 * Benchmark C — Valid alternative design.
 *
 * A completely different decomposition from `strongDesign` — no shared class or
 * interface name, no `PricingStrategy` seam at all, direct dependencies where the
 * strong design chose composition. It is exactly as complete: both requirements
 * mapped, one decision, one edge case. The whole point of this case is that
 * nothing about it should read as worse than `strongDesign` merely for being
 * different — see `docs/EVALUATION_BENCHMARK.md#valid-alternative-design`.
 */
const validAlternativeDesign: BenchmarkCase = {
  id: "valid-alternative-design",
  problem,
  category: "VALID_ALTERNATIVE",
  intent:
    "A structurally different but equally reasonable decomposition must receive the same class of deterministic assessment as the strong design, with no hidden canonical comparison.",
  design: {
    classes: [
      {
        id: "cls_entry",
        name: "EntryController",
        responsibility: "Validates an arriving vehicle and requests a spot for it.",
        attributes: [],
        methods: [{ name: "admit" }],
      },
      {
        id: "cls_allocator",
        name: "SpotAllocator",
        responsibility: "Chooses and reserves a compatible free spot for an admitted vehicle.",
        attributes: [],
        methods: [{ name: "allocate" }, { name: "release" }],
      },
      {
        id: "cls_billing",
        name: "ExitBilling",
        responsibility: "Computes and collects the amount owed when a vehicle exits.",
        attributes: [{ name: "ratePerHour", type: "number" }],
        methods: [{ name: "settle" }],
      },
      {
        id: "cls_record",
        name: "ParkingRecord",
        responsibility: "Records where and when a vehicle was parked.",
        attributes: [
          { name: "spotId", type: "string" },
          { name: "issuedAt", type: "Date" },
        ],
        methods: [],
      },
    ],
    interfaces: [],
    relationships: [
      { source: "EntryController", target: "SpotAllocator", type: "DEPENDENCY" },
      { source: "SpotAllocator", target: "ParkingRecord", type: "COMPOSITION" },
      { source: "ExitBilling", target: "ParkingRecord", type: "DEPENDENCY" },
    ],
    decisions: [
      {
        decision: "Split entry admission from spot allocation into two classes.",
        rationale: "Keeps the compatibility check independent of which spot is ultimately chosen.",
        tradeoff: "One more class than a single Allocator would need.",
      },
    ],
    edgeCases: [
      {
        description: "No compatible spot is free.",
        expectedBehavior: "Entry is refused before a ticket is issued.",
      },
    ],
    requirementMappings: [
      {
        requirementId: "req_pl_01",
        references: [{ entity: "SpotAllocator", field: "methods", value: "allocate" }],
      },
      {
        requirementId: "req_pl_02",
        references: [{ entity: "ExitBilling", field: "methods", value: "settle" }],
      },
    ],
  },
  expectedDeterministicFindings: [
    "Both requirements carry an explicit mapping, exactly as in the strong design, despite sharing no class name with it.",
    "Structural validity, completeness, decisions and edge cases are all adequate on their own terms.",
  ],
  expectedSemanticFindings: [
    "ExitBilling computing the fee inline, with no seam, is a defensible simplification given only one tariff is stated — not an error.",
    "Direct dependencies (ExitBilling on ParkingRecord) are acceptable: ParkingRecord is not a stated variation point.",
  ],
  expectedStrengths: [
    "Entry admission and spot selection are kept independent, which the brief's compatibility rule benefits from.",
  ],
  knownTradeoffs: [
    "No pricing seam exists, so if a second tariff appears later, ExitBilling itself will need to change — a cost this design's decision does not pre-pay for.",
  ],
  mockAiReview: {
    criteria: [
      {
        criterion: "RESPONSIBILITY",
        assessment: "ADEQUATE",
        evidence: [
          { entity: "SpotAllocator", field: "responsibility", value: "Chooses and reserves a compatible free spot for an admitted vehicle." },
        ],
        confidence: 0.7,
      },
      {
        criterion: "ABSTRACTION",
        assessment: "ADEQUATE",
        evidence: [
          { entity: "ExitBilling", field: "attributes", value: "ratePerHour" },
        ],
        concern: "No pricing seam exists, which is proportionate today since only one tariff is stated.",
        confidence: 0.6,
      },
    ],
    strengths: [
      "Admission and allocation are independent, which fits the brief's allocation-policy variation.",
    ],
    priorityImprovements: [],
    summary: "A simpler, differently-shaped decomposition that meets the stated requirements without needing a pricing seam yet.",
  },
};

/**
 * Benchmark D — Over-engineered design.
 *
 * Both strategies genuinely earn a seam — the brief says allocation and pricing
 * policy each vary independently — so `IAllocationStrategy` and `IPricingStrategy`
 * are not the problem. The factories on top of them are: nothing in the brief
 * calls for constructing a strategy dynamically, and each has exactly one
 * implementation. This is deliberately the narrow case the brief warns about:
 * the correct judgement is "this specific layer is unjustified", never
 * "interfaces are bad".
 */
const overEngineeredDesign: BenchmarkCase = {
  id: "over-engineered-design",
  problem,
  category: "OVER_ENGINEERED",
  intent:
    "The evaluator should be able to single out an unjustified layer (the factories) without treating the justified seams (the strategy interfaces) as guilty by association.",
  design: {
    classes: [
      {
        id: "cls_service",
        name: "ParkingLotService",
        responsibility: "Coordinates allocation and pricing through their factories.",
        attributes: [],
        methods: [{ name: "park" }, { name: "exit" }],
      },
      {
        id: "cls_default_allocation",
        name: "DefaultAllocationStrategy",
        responsibility: "Allocates the first compatible free spot.",
        attributes: [],
        methods: [{ name: "chooseSpot" }],
      },
      {
        id: "cls_allocation_factory",
        name: "AllocationStrategyFactory",
        responsibility: "Creates an allocation strategy instance.",
        attributes: [],
        methods: [{ name: "create" }],
      },
      {
        id: "cls_default_pricing",
        name: "DefaultPricingStrategy",
        responsibility: "Computes a flat per-hour fee.",
        attributes: [],
        methods: [{ name: "calculateFee" }],
      },
      {
        id: "cls_pricing_factory",
        name: "PricingStrategyFactory",
        responsibility: "Creates a pricing strategy instance.",
        attributes: [],
        methods: [{ name: "create" }],
      },
      {
        id: "cls_ticket",
        name: "Ticket",
        responsibility: "Records where and when a vehicle was parked.",
        attributes: [{ name: "spotId", type: "string" }],
        methods: [],
      },
    ],
    interfaces: [
      {
        id: "itf_allocation",
        name: "IAllocationStrategy",
        responsibility: "Decides which free spot a vehicle should be allocated.",
        methods: [{ name: "chooseSpot" }],
      },
      {
        id: "itf_allocation_factory",
        name: "IAllocationStrategyFactory",
        responsibility: "Creates an IAllocationStrategy.",
        methods: [{ name: "create" }],
      },
      {
        id: "itf_pricing",
        name: "IPricingStrategy",
        responsibility: "Computes the fee for a completed parking session.",
        methods: [{ name: "calculateFee" }],
      },
      {
        id: "itf_pricing_factory",
        name: "IPricingStrategyFactory",
        responsibility: "Creates an IPricingStrategy.",
        methods: [{ name: "create" }],
      },
    ],
    relationships: [
      { source: "ParkingLotService", target: "IAllocationStrategyFactory", type: "DEPENDENCY" },
      { source: "ParkingLotService", target: "IPricingStrategyFactory", type: "DEPENDENCY" },
      { source: "DefaultAllocationStrategy", target: "IAllocationStrategy", type: "IMPLEMENTATION" },
      { source: "AllocationStrategyFactory", target: "IAllocationStrategyFactory", type: "IMPLEMENTATION" },
      { source: "DefaultPricingStrategy", target: "IPricingStrategy", type: "IMPLEMENTATION" },
      { source: "PricingStrategyFactory", target: "IPricingStrategyFactory", type: "IMPLEMENTATION" },
      { source: "ParkingLotService", target: "Ticket", type: "COMPOSITION" },
    ],
    decisions: [
      {
        decision: "Introduce a factory for both the allocation and the pricing strategy.",
        rationale: "Lets ParkingLotService construct a strategy without knowing its concrete type.",
        tradeoff: "Two extra interfaces and two extra classes, for one implementation of each strategy today.",
      },
    ],
    edgeCases: [
      {
        description: "No compatible spot is free.",
        expectedBehavior: "Allocation is refused without issuing a ticket.",
      },
    ],
    requirementMappings: [
      {
        requirementId: "req_pl_01",
        references: [{ entity: "ParkingLotService", field: "methods", value: "park" }],
      },
      {
        requirementId: "req_pl_02",
        references: [{ entity: "ParkingLotService", field: "methods", value: "exit" }],
      },
    ],
  },
  expectedDeterministicFindings: [
    "The design is structurally valid and complete: every reference resolves, both requirements are mapped, a decision and an edge case are recorded.",
  ],
  expectedSemanticFindings: [
    "IAllocationStrategy and IPricingStrategy are each justified by the brief's stated per-site and independent policy variation.",
    "The two factories add indirection with no stated need to construct a strategy dynamically, and each has exactly one implementation.",
  ],
  expectedStrengths: [
    "The decision honestly names the trade-off it is accepting, rather than presenting the factories as obviously necessary.",
  ],
  knownTradeoffs: [
    "The strategies themselves are reasonable; only the factory layer is the actual finding here.",
  ],
  mockAiReview: {
    criteria: [
      {
        criterion: "ABSTRACTION",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [
          { entity: "AllocationStrategyFactory", field: "responsibility", value: "Creates an allocation strategy instance." },
          { entity: "PricingStrategyFactory", field: "responsibility", value: "Creates a pricing strategy instance." },
        ],
        concern: "Both factories add a layer of indirection with no stated requirement to construct a strategy dynamically, and each strategy has exactly one implementation.",
        suggestion: "Construct DefaultAllocationStrategy and DefaultPricingStrategy directly until a second implementation of either is actually needed.",
        confidence: 0.65,
      },
      {
        criterion: "EXTENSIBILITY",
        assessment: "ADEQUATE",
        evidence: [
          { entity: "IAllocationStrategy", field: "responsibility", value: "Decides which free spot a vehicle should be allocated." },
        ],
        concern: "The strategy interfaces themselves are earning their place: allocation and pricing policy each vary independently per the brief.",
        confidence: 0.6,
      },
    ],
    strengths: [
      "The recorded decision states the trade-off honestly rather than presenting the factories as self-evidently necessary.",
    ],
    priorityImprovements: [
      {
        criterion: "ABSTRACTION",
        priority: "P2",
        what: "Two factory classes exist for two strategies that each have one implementation.",
        where: [
          { entity: "AllocationStrategyFactory", field: "responsibility", value: "Creates an allocation strategy instance." },
        ],
        why: "Indirection with no stated variation to serve costs more than it buys today.",
        reconsider: "Remove the factories; keep the strategy interfaces.",
      },
    ],
    summary: "The strategy seams are justified; the factories on top of them are not, yet.",
  },
};

/**
 * Benchmark E — Missing requirement.
 *
 * Identical to the strong design except one requirement's mapping is dropped
 * entirely. Everything else about the design is left alone, so the only signal
 * this case produces is the one it is testing for.
 */
const missingRequirementDesign: BenchmarkCase = {
  id: "missing-requirement-design",
  problem,
  category: "MISSING_REQUIREMENT",
  intent:
    "An explicit requirement with no mapping at all must be caught deterministically, by name, regardless of how the rest of the design reads.",
  design: {
    ...validParkingLotDesign(),
    requirementMappings: validParkingLotDesign().requirementMappings.filter(
      (mapping) => mapping.requirementId !== "req_pl_02",
    ),
  },
  expectedDeterministicFindings: [
    "req_pl_02 (Parking fee calculation) has no design element mapped to it.",
    "req_pl_01 remains covered, unaffected by the other requirement's gap.",
  ],
  expectedSemanticFindings: [
    "A semantic judge may still find the design's structure reasonable; that must never obscure or soften the deterministic gap.",
  ],
  expectedStrengths: ["req_pl_01 carries explicit design evidence."],
  knownTradeoffs: [
    "This case is deliberately incomplete; the gap is the point, not an oversight to defend.",
  ],
  mockAiReview: {
    criteria: [
      {
        criterion: "ABSTRACTION",
        assessment: "STRONG",
        evidence: [
          { entity: "PricingStrategy", field: "responsibility", value: "Turns a finished parking session into a fee." },
        ],
        confidence: 0.75,
      },
    ],
    strengths: ["The pricing seam is well justified."],
    priorityImprovements: [],
    summary: "Structurally this reads well.",
  },
};

/**
 * Benchmark F — Edge-case-heavy design.
 *
 * Five recorded edge cases (strong on that one deterministic fact) alongside a
 * real, independent coupling flaw: `ParkingLot` depends on `PricingStrategy`
 * *and* directly on the concrete `SizeBasedPricing`, which the seam was meant to
 * avoid. The two signals must surface independently — extensive edge-case
 * coverage recorded elsewhere must not soften, hide, or get averaged against a
 * coupling finding it has nothing to do with.
 */
const edgeCaseHeavyDesign: BenchmarkCase = {
  id: "edge-case-heavy-design",
  problem,
  category: "EDGE_CASE_HEAVY",
  intent:
    "Strong, factual edge-case coverage and a real semantic coupling concern must both surface, independently of each other.",
  design: {
    ...validParkingLotDesign(),
    relationships: [
      ...validParkingLotDesign().relationships,
      { source: "ParkingLot", target: "SizeBasedPricing", type: "DEPENDENCY" },
    ],
    edgeCases: [
      { description: "No compatible spot is free.", expectedBehavior: "Parking is refused without issuing a ticket." },
      { description: "A vehicle exits without ever having parked.", expectedBehavior: "The exit is rejected; no fee is charged." },
      { description: "Two vehicles arrive for the last compatible spot at once.", expectedBehavior: "Exactly one is allocated the spot; the other is refused." },
      { description: "A ticket is presented a second time after the vehicle already exited.", expectedBehavior: "The second exit is rejected as already settled." },
      { description: "A vehicle stays parked across a pricing policy change.", expectedBehavior: "The rate in effect at exit time is the one charged." },
    ],
  },
  expectedDeterministicFindings: [
    "Five edge cases are recorded, each with the behaviour expected — a strong factual result.",
    "This has no bearing on structural validity, completeness, decisions or requirement coverage, which are assessed independently.",
  ],
  expectedSemanticFindings: [
    "ParkingLot depends on both the PricingStrategy abstraction and the concrete SizeBasedPricing directly, which defeats the seam's purpose.",
  ],
  expectedStrengths: ["Edge-case coverage is genuinely strong and specific to this problem."],
  knownTradeoffs: [
    "Thorough edge-case handling does not make the coupling flaw acceptable, and the coupling flaw does not erase the edge-case strength.",
  ],
  mockAiReview: {
    criteria: [
      {
        criterion: "COUPLING",
        assessment: "NEEDS_IMPROVEMENT",
        evidence: [
          { entity: "ParkingLot", field: "relationships", value: "SizeBasedPricing" },
        ],
        concern: "ParkingLot depends on SizeBasedPricing directly as well as through PricingStrategy, so the abstraction is not actually shielding it.",
        suggestion: "Depend only on PricingStrategy; drop the direct relationship to SizeBasedPricing.",
        confidence: 0.65,
      },
      {
        criterion: "EDGE_CASES",
        assessment: "STRONG",
        evidence: [
          { entity: "ParkingLot", field: "responsibility", value: "Owns levels and coordinates parking and exit flows." },
        ],
        confidence: 0.7,
      },
    ],
    strengths: [
      "Five specific, well-reasoned edge cases are recorded for this exact problem.",
    ],
    priorityImprovements: [
      {
        criterion: "COUPLING",
        priority: "P2",
        what: "ParkingLot depends on SizeBasedPricing directly, in addition to PricingStrategy.",
        where: [{ entity: "ParkingLot", field: "relationships", value: "SizeBasedPricing" }],
        why: "A direct dependency alongside the abstraction means the seam does not actually decouple ParkingLot from the concrete pricing class.",
        reconsider: "Remove the direct relationship; reach SizeBasedPricing only through PricingStrategy.",
      },
    ],
    summary: "Edge-case coverage is a genuine strength; a coupling flaw elsewhere is a separate, real concern.",
  },
};

export const BENCHMARK_CASES: readonly BenchmarkCase[] = [
  strongDesign,
  weakDesign,
  validAlternativeDesign,
  overEngineeredDesign,
  missingRequirementDesign,
  edgeCaseHeavyDesign,
];

export function benchmarkCase(id: string): BenchmarkCase {
  const found = BENCHMARK_CASES.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`No benchmark case registered with id "${id}".`);
  }
  return found;
}
