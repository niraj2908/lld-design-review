import type { RequirementPriority } from "@/domain/problem/requirement";
import type { EvaluationCriterion } from "@/domain/problem/rubric";

/**
 * The seeded problem catalogue.
 *
 * Each entry gives the learner enough to reason from — context, constraints,
 * explicit requirements — and deliberately gives the evaluator no reference
 * design. Requirements describe what the design must account for, never which
 * classes or patterns to use, because several designs can satisfy them.
 */
export interface SeedRequirement {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly priority: RequirementPriority;
}

export interface SeedRubricCriterion {
  readonly criterion: EvaluationCriterion;
  readonly weight: number;
  readonly guidance: string;
}

export interface SeedProblem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context: string;
  readonly constraints: readonly string[];
  readonly requirements: readonly SeedRequirement[];
  readonly rubricVersion: string;
  readonly rubricCriteria: readonly SeedRubricCriterion[];
}

export const SEED_LEARNER = {
  id: "lrn_seed",
  displayName: "Practice learner",
} as const;

const PARKING_LOT: SeedProblem = {
  id: "prb_parking_lot",
  slug: "parking-lot",
  title: "Parking Lot",
  description:
    "Model the classes behind a multi-level parking lot that admits vehicles, issues tickets and charges for the time parked.",
  context:
    "A single site has several levels. Each level has spots of different sizes, and not every vehicle fits every spot. A vehicle is admitted at an entry barrier, receives a ticket, and pays at an exit barrier before leaving. The operator changes tariffs seasonally and runs different allocation rules at different sites.",
  constraints: [
    "A spot holds at most one vehicle at a time.",
    "Allocation rules differ per site and may change without redeploying.",
    "Pricing rules change independently of allocation rules.",
    "The lot must keep working when it is completely full.",
  ],
  requirements: [
    {
      code: "PL-REQ-01",
      title: "Compatible spot allocation",
      description:
        "An admitted vehicle must be assigned a free spot that its type can actually occupy.",
      priority: "MUST",
    },
    {
      code: "PL-REQ-02",
      title: "Ticket issued on entry",
      description:
        "Entry must produce a record that identifies the vehicle, the assigned spot and the entry time.",
      priority: "MUST",
    },
    {
      code: "PL-REQ-03",
      title: "Fee for time parked",
      description:
        "Exit must produce an amount owed that depends on how long the vehicle occupied its spot.",
      priority: "MUST",
    },
    {
      code: "PL-REQ-04",
      title: "Spot released after exit",
      description:
        "Once a vehicle leaves, its spot must become available to the next vehicle.",
      priority: "MUST",
    },
    {
      code: "PL-REQ-05",
      title: "Full lot is refused cleanly",
      description:
        "When no compatible spot is free, entry must be refused without issuing a ticket or reserving a spot.",
      priority: "MUST",
    },
    {
      code: "PL-REQ-06",
      title: "Tariffs and allocation vary independently",
      description:
        "Changing how fees are calculated must not require changing how spots are chosen, and the reverse.",
      priority: "SHOULD",
    },
  ],
  rubricVersion: "parking-lot-v1",
  rubricCriteria: [
    {
      criterion: "REQUIREMENT_UNDERSTANDING",
      weight: 0.2,
      guidance:
        "Does the design account for entry, allocation, exit, payment and a full lot?",
    },
    {
      criterion: "RESPONSIBILITY",
      weight: 0.2,
      guidance:
        "Is each responsibility owned by an element that has the data to carry it out?",
    },
    {
      criterion: "EXTENSIBILITY",
      weight: 0.2,
      guidance:
        "Can the two stated variation points, pricing and allocation, change separately?",
    },
    {
      criterion: "ENCAPSULATION",
      weight: 0.15,
      guidance:
        "Is spot occupancy protected, or can any caller leave the lot in an impossible state?",
    },
    {
      criterion: "EDGE_CASES",
      weight: 0.15,
      guidance:
        "Are a full lot, a lost ticket and an unknown vehicle type accounted for?",
    },
    {
      criterion: "DESIGN_REASONING",
      weight: 0.1,
      guidance:
        "Are the abstractions justified by a stated variation point rather than by habit?",
    },
  ],
};

const VENDING_MACHINE: SeedProblem = {
  id: "prb_vending_machine",
  slug: "vending-machine",
  title: "Vending Machine",
  description:
    "Model the classes behind a coin-operated vending machine that only permits operations valid in its current state.",
  context:
    "A machine holds a fixed set of slots, each stocked with one product at one price. A customer inserts coins, selects a product, and receives the product plus change. The machine can be restocked and emptied by an operator. Most of the difficulty is that the same action means different things depending on what has happened so far.",
  constraints: [
    "A product is dispensed only when the amount inserted covers its price.",
    "Coins already inserted must be refundable until the moment a product is dispensed.",
    "The machine may not be able to make exact change.",
    "An operator restocks while the machine is idle, never mid-purchase.",
  ],
  requirements: [
    {
      code: "VM-REQ-01",
      title: "Coins accumulate before selection",
      description:
        "Inserted coins must accumulate into a balance the customer can spend or reclaim.",
      priority: "MUST",
    },
    {
      code: "VM-REQ-02",
      title: "Selection requires sufficient balance",
      description:
        "Selecting a product with an insufficient balance must not dispense it and must not consume the balance.",
      priority: "MUST",
    },
    {
      code: "VM-REQ-03",
      title: "Dispense reduces stock and balance",
      description:
        "A successful purchase must reduce the slot's stock and settle the customer's balance.",
      priority: "MUST",
    },
    {
      code: "VM-REQ-04",
      title: "Refund before dispensing",
      description:
        "A customer must be able to cancel and recover the full inserted amount until a product is dispensed.",
      priority: "MUST",
    },
    {
      code: "VM-REQ-05",
      title: "Sold-out slot is rejected",
      description:
        "Selecting an empty slot must be refused and must leave the inserted balance untouched.",
      priority: "MUST",
    },
    {
      code: "VM-REQ-06",
      title: "Invalid operations are rejected, not ignored",
      description:
        "An operation that makes no sense in the current state, such as dispensing before selection, must be rejected explicitly.",
      priority: "MUST",
    },
    {
      code: "VM-REQ-07",
      title: "Change shortfall is handled",
      description:
        "The design must say what happens when the machine cannot return exact change.",
      priority: "SHOULD",
    },
  ],
  rubricVersion: "vending-machine-v1",
  rubricCriteria: [
    {
      criterion: "REQUIREMENT_UNDERSTANDING",
      weight: 0.15,
      guidance:
        "Does the design cover insert, select, dispense, refund and restock?",
    },
    {
      criterion: "ENCAPSULATION",
      weight: 0.2,
      guidance:
        "Can an outside caller put the machine into a state the rules forbid?",
    },
    {
      criterion: "RESPONSIBILITY",
      weight: 0.2,
      guidance:
        "Is the transition logic owned by one element rather than scattered across callers?",
    },
    {
      criterion: "EDGE_CASES",
      weight: 0.2,
      guidance:
        "Are sold-out slots, insufficient balance, cancellation and a change shortfall addressed?",
    },
    {
      criterion: "COHESION",
      weight: 0.15,
      guidance:
        "Do inventory, money handling and state transitions sit in coherent places?",
    },
    {
      criterion: "DESIGN_REASONING",
      weight: 0.1,
      guidance: "Is the chosen way of modelling state explained and justified?",
    },
  ],
};

const ELEVATOR_SYSTEM: SeedProblem = {
  id: "prb_elevator_system",
  slug: "elevator-system",
  title: "Elevator System",
  description:
    "Model the classes behind a bank of elevators serving requests in a building, including how a car is chosen for a request.",
  context:
    "A building has several floors and more than one elevator car. Requests arrive from hall panels, which state a floor and a direction, and from inside a car, which state a destination floor. A car moves, stops, opens and closes its doors. The building operates differently at peak hours, so the rule for choosing a car must be replaceable.",
  constraints: [
    "A car serves one direction of travel at a time.",
    "A request must eventually be served; none may be dropped silently.",
    "The rule that picks a car must be replaceable without rewriting the cars.",
    "A car can be taken out of service for maintenance while the bank keeps running.",
  ],
  requirements: [
    {
      code: "EL-REQ-01",
      title: "Both request kinds are modelled",
      description:
        "A hall request, which names a floor and a direction, and a car request, which names a destination, must both be represented.",
      priority: "MUST",
    },
    {
      code: "EL-REQ-02",
      title: "A request is assigned to a car",
      description:
        "Every accepted request must end up assigned to exactly one car.",
      priority: "MUST",
    },
    {
      code: "EL-REQ-03",
      title: "Car movement and doors are explicit",
      description:
        "The design must represent a car's motion and door state, and which combinations are legal.",
      priority: "MUST",
    },
    {
      code: "EL-REQ-04",
      title: "Assignment rule is replaceable",
      description:
        "The rule that chooses which car serves a request must be changeable independently of the cars themselves.",
      priority: "MUST",
    },
    {
      code: "EL-REQ-05",
      title: "Out-of-service cars are skipped",
      description:
        "A car under maintenance must not receive new requests, and requests already assigned to it must not be lost.",
      priority: "SHOULD",
    },
    {
      code: "EL-REQ-06",
      title: "Requests for the current floor",
      description:
        "A request for the floor a car is already stopped at must be handled sensibly rather than queued forever.",
      priority: "SHOULD",
    },
  ],
  rubricVersion: "elevator-system-v1",
  rubricCriteria: [
    {
      criterion: "REQUIREMENT_UNDERSTANDING",
      weight: 0.2,
      guidance:
        "Are both request kinds, assignment and movement all accounted for?",
    },
    {
      criterion: "ABSTRACTION",
      weight: 0.2,
      guidance:
        "Is the car-selection rule expressed as a replaceable abstraction?",
    },
    {
      criterion: "RESPONSIBILITY",
      weight: 0.2,
      guidance:
        "Is scheduling separated from a single car's own motion and doors?",
    },
    {
      criterion: "COUPLING",
      weight: 0.15,
      guidance:
        "Does the scheduler depend on car internals it should not know about?",
    },
    {
      criterion: "EDGE_CASES",
      weight: 0.15,
      guidance:
        "Are maintenance, same-floor requests and an idle bank addressed?",
    },
    {
      criterion: "EXTENSIBILITY",
      weight: 0.1,
      guidance: "Could a peak-hour policy be added without reworking the model?",
    },
  ],
};

const NOTIFICATION_SYSTEM: SeedProblem = {
  id: "prb_notification_system",
  slug: "notification-system",
  title: "Notification System",
  description:
    "Model the classes behind a service that delivers a notification to a recipient over one or more channels, including what happens when a channel fails.",
  context:
    "Other parts of a product ask this service to notify a user about an event. Delivery can go by email, SMS or push, and more channels will be added. A recipient has preferences about which channels to use and may opt out. Channels are third-party services: they are slow sometimes and unavailable sometimes.",
  constraints: [
    "New channels are added without changing the code that sends notifications.",
    "A channel call can fail or time out.",
    "A recipient's preferences and opt-outs must be respected.",
    "The same notification must not be delivered twice over the same channel.",
  ],
  requirements: [
    {
      code: "NS-REQ-01",
      title: "Notification is channel-independent",
      description:
        "The thing being sent must be expressible without naming a specific channel.",
      priority: "MUST",
    },
    {
      code: "NS-REQ-02",
      title: "A channel is an interchangeable delivery mechanism",
      description:
        "Adding a channel must not require editing the element that decides to notify.",
      priority: "MUST",
    },
    {
      code: "NS-REQ-03",
      title: "Recipient preferences are honoured",
      description:
        "Delivery must respect which channels the recipient allows, including a full opt-out.",
      priority: "MUST",
    },
    {
      code: "NS-REQ-04",
      title: "Per-channel failure is contained",
      description:
        "A failure on one channel must not prevent delivery attempts on the others, and must be recorded.",
      priority: "MUST",
    },
    {
      code: "NS-REQ-05",
      title: "Delivery outcome is observable",
      description:
        "The caller or an operator must be able to find out what was attempted and what the result was.",
      priority: "MUST",
    },
    {
      code: "NS-REQ-06",
      title: "No duplicate delivery",
      description:
        "A retried send must not deliver the same notification twice over the same channel.",
      priority: "SHOULD",
    },
  ],
  rubricVersion: "notification-system-v1",
  rubricCriteria: [
    {
      criterion: "ABSTRACTION",
      weight: 0.2,
      guidance:
        "Is a channel modelled as a contract rather than as a set of concrete cases?",
    },
    {
      criterion: "EXTENSIBILITY",
      weight: 0.2,
      guidance: "Can a new channel be added without touching existing senders?",
    },
    {
      criterion: "COUPLING",
      weight: 0.15,
      guidance:
        "Does the sending logic depend on any specific provider's details?",
    },
    {
      criterion: "EDGE_CASES",
      weight: 0.2,
      guidance:
        "Are channel failure, timeout, opt-out and retry duplication addressed?",
    },
    {
      criterion: "RESPONSIBILITY",
      weight: 0.15,
      guidance:
        "Are preference resolution, delivery and outcome recording owned separately?",
    },
    {
      criterion: "TESTABILITY",
      weight: 0.1,
      guidance: "Could a channel be substituted in a test without a network?",
    },
  ],
};

export const SEED_PROBLEMS: readonly SeedProblem[] = [
  PARKING_LOT,
  VENDING_MACHINE,
  ELEVATOR_SYSTEM,
  NOTIFICATION_SYSTEM,
];
