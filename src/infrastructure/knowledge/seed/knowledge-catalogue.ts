import { knowledgeDocumentId } from "@/domain/knowledge/knowledge-identity";
import type { KnowledgeDocument } from "@/domain/knowledge/knowledge-document";
import type { KnowledgeTopic } from "@/domain/knowledge/knowledge-topic";

export const KNOWLEDGE_VERSION = "lld-kb-v1";

const SEEDED_AT = new Date("2026-01-01T00:00:00.000Z");

interface SeedEntry {
  readonly slug: string;
  readonly title: string;
  readonly source: string;
  readonly topic: KnowledgeTopic;
  readonly concepts: readonly string[];
  readonly problemSlug?: string;
  readonly content: string;
}

/**
 * The curated knowledge base.
 *
 * Every entry explains how to reason about a design decision — what a concept
 * means, what evidence suggests it applies, and what it costs. None of them
 * contains a class list, a diagram, or a worked solution to a seeded problem, and
 * none should be added: the product accepts several valid designs, and a stored
 * answer key would quietly turn retrieval into comparison.
 *
 * The problem-specific entries name the variation points and difficulties each
 * problem contains. They deliberately stop short of saying which elements to
 * create.
 */
const ENTRIES: readonly SeedEntry[] = [
  {
    slug: "responsibility-assignment",
    title: "Assigning responsibility",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["responsibility", "information expert", "scope"],
    content: `A responsibility is something an element is accountable for, stated in terms of what it does for others rather than what it holds. "Tracks which spots are free" is a responsibility; "has a list of spots" is a field.

The usual test for placement is whether the element has the information it needs to carry the responsibility out without asking several collaborators for their internals. When a method mostly reads another element's data, the behaviour is often in the wrong place — though moving it is only an improvement if the data it needs really does live elsewhere.

Two failure shapes are common. One element ends up accountable for several unrelated jobs, so every change touches it. Or a responsibility is split so finely that carrying it out requires a conversation between four elements, and no single place explains the rule. Neither is settled by counting methods: the question is whether a reader can say, in one sentence, what each element is for.

Judging this from a submission means reading the responsibility text against the methods and relationships declared. A responsibility that mentions two unrelated verbs, or an element whose methods have nothing to do with its stated responsibility, is evidence worth raising. A design that simply divides the work differently from how you would is not.`,
  },
  {
    slug: "encapsulation",
    title: "Encapsulation and protecting invariants",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["encapsulation", "invariant", "information hiding"],
    content: `Encapsulation is about which states an element can be put into by the code around it. An element is well encapsulated when every rule it is responsible for holds no matter what order its public operations are called in, and badly encapsulated when a caller has to remember to do something for the rule to survive.

The practical question is not "are the fields private". It is "can a caller leave this in a state the design says is impossible". A spot that can be marked occupied without a vehicle, a machine that can dispense before payment, a ticket whose exit time precedes its entry time: each is a rule the element claims but does not enforce.

Exposing a mutable collection is the most common leak. Returning the internal list of spots lets any caller add, remove or reorder them, so the element's rules about occupancy are advisory. Returning a copy, or an operation that performs the change, keeps the rule inside.

There is a cost. Every invariant enforced inside an element is flexibility removed from its callers, and an element that validates things nobody was going to get wrong is friction. Enforce the rules the problem actually states.`,
  },
  {
    slug: "abstraction-and-variation-points",
    title: "Abstraction earning its place",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["abstraction", "interface", "variation point", "premature abstraction"],
    content: `An abstraction is worth introducing when it absorbs a variation the problem says exists. "Pricing rules change seasonally" is a variation point; "there might be other kinds of pricing one day" usually is not.

The useful test is to name the change the abstraction absorbs and point at the requirement or constraint that predicts it. If no requirement predicts it, the abstraction is a guess, and guesses cost: an extra indirection to read through, a seam to keep consistent, and a shape that is harder to change than the concrete code it replaced when the variation finally arrives in a different form than expected.

The reverse error is real too. When a requirement plainly states that two policies vary independently, and the design settles both inside one element, a later change to either touches the same code. That is worth raising — with the requirement quoted, not as a preference for more interfaces.

Neither error is detectable by counting interfaces. A design with none may be right for a problem with no stated variation, and a design with several may be right for one with several.`,
  },
  {
    slug: "composition-versus-inheritance",
    title: "Composition and inheritance",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["composition", "inheritance", "delegation", "substitutability"],
    content: `Inheritance says a subtype is usable everywhere the supertype is. Composition says an element uses another to do part of its job. Both are legitimate, and the choice is not a matter of fashion.

Inheritance fits when the relationship is genuinely "is a kind of" and every operation on the supertype makes sense on the subtype. It goes wrong when it is used to share code between things that are not substitutable: the subtype then has to weaken a guarantee, refuse an operation, or carry state it has no use for.

Composition fits when the relationship is "needs one of these to work", and it is easier to change at run time. Its cost is more wiring: something has to decide which collaborator an element gets.

When reviewing, the signal is not which was chosen but whether the chosen one holds. An inheritance edge where the subtype cannot honour an inherited operation is worth raising. Composition where a problem describes a strict type hierarchy is not automatically wrong — ask what the design does when substitutability is required.`,
  },
  {
    slug: "cohesion",
    title: "Cohesion",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["cohesion", "single purpose", "naming"],
    content: `An element is cohesive when its parts are all in service of one job. Low cohesion shows up as an element whose methods fall into two groups that never touch each other's data, or whose name needs "and" to describe it.

Cohesion is about relatedness, not size. A large element whose every method works on the same state can be perfectly cohesive; a small one holding two unrelated helpers is not. Splitting by size alone tends to produce elements that must be read together to understand either.

Reading it from a submission: look at whether the stated responsibility covers everything the element declares, and whether the attributes are used by all of the methods or by disjoint subsets. Disjoint subsets are the clearest evidence, and they are visible without knowing the implementation.`,
  },
  {
    slug: "coupling-and-dependency-direction",
    title: "Coupling and dependency direction",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["coupling", "dependency direction", "stability"],
    content: `Coupling is how much one element must know about another to work. Some is necessary — elements that never depend on anything cannot collaborate. The question is whether each dependency is justified and pointed the right way.

Direction matters more than count. A rule that is stable should not depend on a detail that changes often; when it does, every change to the detail reaches the rule. Pointing the dependency the other way, so the changeable part depends on the stable one, localises the change. This is the practical content of dependency inversion, and it is worth describing in those terms rather than as a pattern to apply.

Signals visible in a structured submission: an element that depends on many others, a cycle, a dependency from something the problem describes as fixed onto something it describes as varying, or a dependency that exists only to reach through one element to another's data.

Reducing coupling has a price: indirection, and sometimes an interface whose only implementation is the thing it was extracted from. Worth paying where the problem predicts the change, not everywhere.`,
  },
  {
    slug: "testability",
    title: "Testability as a design property",
    source: "DesignReview knowledge base",
    topic: "OOP",
    concepts: ["testability", "seams", "determinism", "dependency injection"],
    content: `A design is testable when its important behaviour can be exercised without standing up everything around it. This is mostly a consequence of dependency direction: an element that receives its collaborators can be tested with simple ones, and an element that constructs them or reaches for global state cannot.

Two things commonly make behaviour untestable. Time and randomness taken directly from the environment mean a test cannot fix the conditions it wants. And a rule buried inside an element that also performs input or output means testing the rule requires performing the input or output.

From a structured submission, the evidence is in the declared dependencies: whether the elements that hold rules depend on abstractions or on concrete services, and whether anything that clearly touches the outside world sits in the same element as a rule. A design that never mentions how collaborators arrive is not necessarily untestable, but it has not shown that it is testable either.`,
  },
  {
    slug: "solid-srp",
    title: "Single responsibility",
    source: "DesignReview knowledge base",
    topic: "SOLID",
    concepts: ["SRP", "reasons to change", "cohesion"],
    content: `The single responsibility principle is most useful read as "an element should have one reason to change". Reasons to change come from the people and rules the software serves: a pricing rule and an allocation rule change on different schedules and often at the request of different people, so an element that encodes both has two reasons to change.

Read as "an element should do one thing" it degenerates, because "one thing" can be made arbitrarily small. The reasons-to-change reading gives a test that can be checked against the problem: name the changes the requirements predict, then see whether any element would be touched by two unrelated ones.

It is not a licence to split by noun. Two rules that always change together belong together, and separating them adds a seam that must be kept consistent for no benefit.`,
  },
  {
    slug: "solid-ocp",
    title: "Open for extension",
    source: "DesignReview knowledge base",
    topic: "SOLID",
    concepts: ["OCP", "extension", "variation point"],
    content: `The open/closed principle asks whether a predicted kind of addition can be made without editing what already works. A design that needs a new branch in an existing conditional for every new channel, spot type or pricing rule is closed to that extension.

The principle is about a specific axis of change, not a general property. Every design is open to some additions and closed to others, and being closed to something the problem never predicts is not a defect. So the useful form of the finding is "requirement X says channels will be added, and adding one requires editing element Y" — naming the axis and the requirement.

The cost of opening an axis is an abstraction and its indirection. Opening every axis produces a design where nothing can be read end to end.`,
  },
  {
    slug: "solid-lsp",
    title: "Substitutability",
    source: "DesignReview knowledge base",
    topic: "SOLID",
    concepts: ["LSP", "inheritance", "contracts"],
    content: `The Liskov substitution principle says a subtype must be usable wherever its supertype is, without a caller needing to know which one it has. Violations look like a subtype that refuses an inherited operation, throws where the supertype returns, narrows what it accepts, or quietly does nothing.

The point is not about type systems: a compiler will accept a subtype that breaks every promise the supertype made in prose. What matters is the contract as described, including the parts written in responsibility text rather than in signatures.

When a violation appears, the fix is usually not a smaller hierarchy but a different relationship: composition, or a shared abstraction that promises only what both can honour.`,
  },
  {
    slug: "solid-isp",
    title: "Interface size",
    source: "DesignReview knowledge base",
    topic: "SOLID",
    concepts: ["ISP", "interface", "client-specific contracts"],
    content: `The interface segregation principle says a client should not be made to depend on operations it does not use. A wide interface forces implementers to supply behaviour they have no use for, and couples every client to changes in parts of it they never call.

The useful signal is an implementer that leaves operations empty or unsupported, or a client that depends on an interface for one of its eight methods. Both are visible in a structured submission.

The opposite error exists: a swarm of one-method interfaces can obscure that several of them are always implemented and used together. Split interfaces along client needs, not along methods.`,
  },
  {
    slug: "solid-dip",
    title: "Dependency inversion",
    source: "DesignReview knowledge base",
    topic: "SOLID",
    concepts: ["DIP", "dependency direction", "abstraction ownership"],
    content: `Dependency inversion says that the elements holding rules should not depend on the elements holding details, and that the abstraction between them should be owned by the rule rather than by the detail. An abstraction defined to suit a particular database or provider has not inverted anything; it has moved the detail behind a name.

The observable consequence is which side has to change when the detail changes. If swapping a provider means editing the rule, the dependency still points inward from the rule to the detail.

This is where an interface earns its keep even with a single implementation: the interface exists so that the rule can state what it needs in its own terms. That is a real justification, and it is different from extracting an interface because there may be a second implementation one day.`,
  },
  {
    slug: "pattern-strategy",
    title: "Strategy",
    source: "DesignReview knowledge base",
    topic: "PATTERN",
    concepts: ["Strategy", "algorithm variation", "policy"],
    content: `Strategy names a shape where a family of interchangeable algorithms sits behind one contract, and the element using them does not know which it has. It fits when the problem says a policy varies independently of the work around it — pricing, allocation, scheduling, retry.

What makes it appropriate is the stated variation, not the pattern's popularity. Recognising the shape in a design is worth noting; asking for it where no requirement predicts a second algorithm is cargo cult.

Its costs are real: an extra indirection, and a decision about who chooses the strategy and when. If the choice itself becomes a growing conditional somewhere else, the variation has been moved rather than absorbed.

Note also that a design may achieve the same independence without anything resembling the classic shape — a function parameter, or configuration consulted at the point of use. The property that matters is that the policy can change without editing the work.`,
  },
  {
    slug: "pattern-state",
    title: "State",
    source: "DesignReview knowledge base",
    topic: "PATTERN",
    concepts: ["State", "state machine", "invalid transitions"],
    content: `Modelling state explicitly matters when the same operation means different things depending on what has happened, and when some operations are invalid in some situations. A vending machine that has taken no money and one that is mid-purchase respond differently to the same button.

There are several honest ways to model this: a field holding a state value with transitions checked in one place, one element per state, or a table of allowed transitions. What matters is that the allowed transitions are stated somewhere a reader can find, and that an invalid operation is refused explicitly rather than silently ignored or left to produce a nonsense state.

The signals of trouble are scattered conditionals over a status field, and a design that says what each operation does without saying when it is allowed. Both are visible from responsibilities and method lists.

The cost of one element per state is more elements and a transition graph spread across them; the cost of a status field is that the rules can leak into callers. Neither is wrong by default.`,
  },
  {
    slug: "pattern-observer",
    title: "Observer",
    source: "DesignReview knowledge base",
    topic: "PATTERN",
    concepts: ["Observer", "events", "decoupling"],
    content: `Observer names a shape where something announces that a fact has changed and interested parties react, without the announcer knowing who they are. It fits when the set of reactions is expected to grow, and when the announcer genuinely should not care whether anyone is listening.

It buys the announcer independence from its audience. It costs traceability: the sequence of what happens after an event is no longer readable in one place, ordering between listeners is usually unspecified, and a failing listener raises a question the shape does not answer by itself — whether the announcement succeeded.

So it is worth asking, when a design uses it, what happens when a listener fails, and whether the problem actually predicts new listeners. And worth asking, when a design does not use it, whether a direct call is simply clearer here.`,
  },
  {
    slug: "pattern-factory",
    title: "Factory",
    source: "DesignReview knowledge base",
    topic: "PATTERN",
    concepts: ["Factory", "construction", "dependency direction"],
    content: `A factory concentrates the decision about which concrete thing to build, so the elements using it depend on the abstraction rather than on a constructor. It is most useful when that decision has rules of its own — reading configuration, inspecting an input, enforcing that only valid combinations are built.

Where the decision is trivial, a factory adds a layer without moving anything: a single-branch factory is usually just a constructor with more ceremony.

The useful review question is where the knowledge of concrete types lives. If it is spread across the elements that use them, concentrating it is an improvement worth describing. If a design places that knowledge in one composition point without calling it a factory, that is the same property achieved differently.`,
  },
  {
    slug: "pattern-decorator",
    title: "Decorator",
    source: "DesignReview knowledge base",
    topic: "PATTERN",
    concepts: ["Decorator", "composition", "cross-cutting behaviour"],
    content: `A decorator wraps something with the same contract and adds behaviour around it — retries, logging, caching, validation. It fits when the additions are optional and combinable, and when the wrapped element should not know about them.

It is a composition answer to a problem that inheritance handles badly: with several independent additions, subclassing produces a class per combination, while wrapping produces one per addition.

Its costs are a longer chain to read through when debugging, and order sensitivity — a retry inside a cache behaves differently from a cache inside a retry. A design that stacks decorators should be able to say why the order is what it is.`,
  },
  {
    slug: "smell-god-object",
    title: "God object",
    source: "DesignReview knowledge base",
    topic: "DESIGN_SMELL",
    concepts: ["God Object", "cohesion", "responsibility"],
    content: `A god object is an element that accumulates responsibilities until most changes to the system touch it. The evidence is not its size but its reach: it knows several unrelated subject areas, most other elements depend on it, and its stated responsibility needs several clauses.

It matters because it concentrates risk. Every change touches the same code, changes for unrelated reasons collide, and the element becomes hard to test because exercising any part of it requires most of its collaborators.

Care is needed in judging it. A coordinator that delegates is not a god object because many things pass through it; what makes it one is holding the rules for all of them. And a small design with one element doing everything may be a reasonable answer to a small problem — the finding is worth raising when the requirements predict changes that would collide.`,
  },
  {
    slug: "smell-tight-coupling",
    title: "Tight coupling",
    source: "DesignReview knowledge base",
    topic: "DESIGN_SMELL",
    concepts: ["Tight Coupling", "encapsulation", "dependency direction"],
    content: `Tight coupling is a dependency on more of another element than the work requires: on its concrete type when an abstraction would do, on its internal structure, or on the order in which its operations must be called.

The recognisable shapes are reaching through one element to get at another's data, an element that must be constructed in a particular sequence for anything to work, and two elements that always change together though neither mentions the other in its responsibility.

Diagnosing it from a submission means reading the relationships against the responsibilities: a dependency that no responsibility explains is worth asking about. The remedy is not always an interface — sometimes the behaviour simply belongs on the element holding the data.`,
  },
  {
    slug: "smell-shotgun-surgery",
    title: "Shotgun surgery",
    source: "DesignReview knowledge base",
    topic: "DESIGN_SMELL",
    concepts: ["Shotgun Surgery", "cohesion", "extensibility"],
    content: `Shotgun surgery is the shape where one conceptual change requires edits in many places. Adding a notification channel means touching a conditional, a factory, a configuration file, an enum and three call sites.

It is the mirror image of a god object: instead of one element knowing too much, a single piece of knowledge is scattered. It is worth diagnosing by walking a change the requirements predict and counting the places it lands.

The remedy is to gather the scattered knowledge behind one seam, which usually means an abstraction with one place that decides. The cost is the indirection, and the finding is only worth raising when the change being walked is one the problem says will happen.`,
  },
  {
    slug: "smell-anemic-domain-model",
    title: "Anaemic domain model",
    source: "DesignReview knowledge base",
    topic: "DESIGN_SMELL",
    concepts: ["Anemic Domain Model", "responsibility", "encapsulation"],
    content: `An anaemic model is one where the elements named after domain concepts hold only data, and all the rules live in services that operate on them. The names suggest a domain model; the structure is records and procedures.

The cost is that the rules are not protected by the things they govern: any service can put a record into an invalid state, and the same rule tends to be reimplemented in several services. Rules also become hard to find, because the element named after the concept says nothing about it.

Judging it needs care. Some elements genuinely are data — a message being transported, a row being reported. The finding applies where a concept has rules the submission states, and those rules are declared somewhere other than the element that owns the data they constrain. And there are architectures that deliberately separate data from behaviour; the question is whether the design says why.`,
  },
  {
    slug: "smell-premature-abstraction",
    title: "Premature abstraction",
    source: "DesignReview knowledge base",
    topic: "DESIGN_SMELL",
    concepts: ["Premature Abstraction", "abstraction", "speculative generality"],
    content: `Premature abstraction is a seam introduced for a variation that nothing predicts: an interface with one implementation and no stated axis of change, a configuration point nobody configures, a hierarchy with one member.

It is worth naming as a smell because the usual review reflex runs the other way — more abstraction reads as more sophisticated. But an unused seam costs real things: another file to read through, a contract to keep consistent, and a shape that constrains the design when the variation finally arrives looking different from the guess.

The test is whether a requirement or constraint predicts the variation. If one does, the abstraction is justified and should be recognised. If none does, the simpler design is the better answer, and saying so is as much a finding as asking for an abstraction would be.`,
  },
  {
    slug: "requirement-to-design-mapping",
    title: "Mapping requirements to design",
    source: "DesignReview knowledge base",
    topic: "LLD_REASONING",
    concepts: ["requirement mapping", "traceability", "coverage"],
    content: `A design answers a set of requirements, and the connection between them should be visible rather than inferred. For each requirement it should be possible to point at the element or interaction that satisfies it.

This is the difference between a design that looks plausible and one that is reviewable. Where the mapping is explicit, a gap is obvious — some requirement has nothing pointing at it — and a reviewer can argue about placement rather than guessing intent. Where it is absent, a reviewer is left matching names to requirements, which rewards designs that happen to use familiar vocabulary.

A name is not a mapping. An element called PaymentProcessor is not evidence that a payment requirement is addressed; what the element is accountable for is. This is also why explicit mapping protects unusual designs: an element named something unexpected is fully credited when the design says what it satisfies.`,
  },
  {
    slug: "state-modelling",
    title: "Modelling state and lifecycle",
    source: "DesignReview knowledge base",
    topic: "LLD_REASONING",
    concepts: ["state", "lifecycle", "transitions", "invalid operations"],
    content: `Where a concept has a lifecycle, the design should say what the states are, which transitions are allowed, and what happens when a disallowed one is attempted. The last part is the one most often missing.

Two questions expose most problems. Can the thing be put into a state the problem says is impossible — parked without a spot, dispensed without payment, completed without being evaluated? And is the answer to an invalid operation an explicit refusal, or is it unspecified?

Keeping the transition rules in one place is usually worth it: when they are spread across callers, each caller has its own idea of what is allowed. Whether that place is a field with a guard, a table, or an element per state is a judgement about the size of the problem.`,
  },
  {
    slug: "edge-cases",
    title: "Edge cases as design input",
    source: "DesignReview knowledge base",
    topic: "LLD_REASONING",
    concepts: ["edge cases", "failure handling", "boundaries"],
    content: `Edge cases are where designs are usually decided. Boundaries — empty, full, exactly at a limit, zero, the first and last item — and failures of things the design depends on both tend to reveal a missing element or a rule with nowhere to live.

A useful habit is to write the edge case as a situation and an expected behaviour, not as a worry. "The lot is full" is a note; "when no compatible spot is free, entry is refused without issuing a ticket" is a design decision that can be checked against the design.

Three families are worth walking deliberately: concurrent access to the same resource, a dependency being slow or unavailable, and the same operation arriving twice. Each one, if the problem has it, usually implies something in the design.

Recording an edge case is not the same as handling it, and a design that lists many without saying what happens has documented its worries rather than its behaviour.`,
  },
  {
    slug: "extensibility",
    title: "Extensibility as a specific claim",
    source: "DesignReview knowledge base",
    topic: "LLD_REASONING",
    concepts: ["extensibility", "change axes", "requirements"],
    content: `Extensibility is not a property a design has in general; it is a property with respect to a named change. The only way to discuss it usefully is to name the change, then trace what a design would have to touch to make it.

So the review question is: which changes do these requirements predict, and for each one, how far does it reach? A change that touches one element is absorbed. One that touches several in unrelated places is not, and that is a finding worth raising with the requirement quoted.

The reverse matters as much. A design that is not extensible along an axis the problem never mentions is not deficient, and saying so protects simple designs from being marked down for the sake of it.`,
  },
  {
    slug: "interface-responsibilities",
    title: "What an interface is for",
    source: "DesignReview knowledge base",
    topic: "LLD_REASONING",
    concepts: ["interface", "contract", "responsibility", "abstraction ownership"],
    content: `An interface is a promise stated in the vocabulary of whoever depends on it. Its operations should read as what the caller needs, not as what one implementation happens to do, and its name should describe the capability rather than the technology behind it.

Two signals that an interface has been written from the wrong side: operations that only make sense for one implementation, and a name that mentions the mechanism. Both mean that swapping the implementation will change the interface, which is the thing an interface exists to prevent.

An interface is also a responsibility in its own right, and it should be possible to say what it is accountable for in one sentence. If that sentence needs "and", the interface probably serves two clients and can be split along their needs.`,
  },
  {
    slug: "guidance-parking-lot",
    title: "What the parking lot problem is really about",
    source: "DesignReview knowledge base",
    topic: "PROBLEM_GUIDANCE",
    problemSlug: "parking-lot",
    concepts: ["allocation", "pricing", "occupancy", "variation points"],
    content: `This problem's difficulty is not the objects — most people find similar ones — but that it states two policies which change on different schedules: how a spot is chosen, and how a stay is priced. A design is worth discussing in terms of whether a change to one reaches the other.

The second theme is occupancy as a rule rather than a field. A spot holds at most one vehicle; whether that rule can be broken by a caller is the encapsulation question here.

The third is what happens at the boundaries: a full lot, a vehicle with no compatible spot, a lost ticket, a vehicle that leaves without paying. Each is a decision the design either makes or leaves open.

There is no expected set of elements. Levels, spots, tickets, gates, pricing and allocation can be arranged many ways, and a design with three elements that keeps the two policies independent has answered the problem as well as one with ten. Discuss the properties, not the shape.`,
  },
  {
    slug: "guidance-vending-machine",
    title: "What the vending machine problem is really about",
    source: "DesignReview knowledge base",
    topic: "PROBLEM_GUIDANCE",
    problemSlug: "vending-machine",
    concepts: ["state modelling", "invalid operations", "money handling"],
    content: `Almost all of this problem is lifecycle. The same operations — insert, select, dispense, refund — mean different things depending on what has already happened, and several of them are invalid at particular moments. A design that lists the operations without saying when each is allowed has not engaged with the problem.

The second theme is money as a rule: a balance that must be refundable until the moment of dispensing, and a shortfall of change that the design has to decide about rather than assume away.

The third is inventory, which is where responsibility placement usually gets interesting — whether the machine, a slot, or something else is accountable for stock, and whether a sold-out slot can be selected.

Several state models are legitimate here: a status field with transitions guarded in one place, an element per state, or an explicit transition table. What matters is that the allowed transitions are written down and that an invalid operation is refused explicitly.`,
  },
  {
    slug: "guidance-elevator-system",
    title: "What the elevator problem is really about",
    source: "DesignReview knowledge base",
    topic: "PROBLEM_GUIDANCE",
    problemSlug: "elevator-system",
    concepts: ["scheduling", "request modelling", "state", "policy variation"],
    content: `This problem's centre is that two different things are being modelled: a car, which has motion and doors and rules about both, and a decision about which car should serve a request. Keeping those separable is what makes a peak-hour policy possible later, and the requirements say that policy will change.

The second theme is that requests are not all alike. A hall request names a floor and a direction; a car request names a destination. Designs that collapse them usually lose information the scheduler needs.

The third is the awkward cases: a request for the floor a car is already stopped at, a car taken out of service with requests already assigned to it, and a bank with nothing to do. Each one is a decision.

Many arrangements work. The properties to discuss are whether the selection rule can be replaced without touching the cars, whether a car's legal combinations of motion and door state are stated, and whether every accepted request is accounted for.`,
  },
  {
    slug: "guidance-notification-system",
    title: "What the notification problem is really about",
    source: "DesignReview knowledge base",
    topic: "PROBLEM_GUIDANCE",
    problemSlug: "notification-system",
    concepts: ["channel abstraction", "failure handling", "idempotency", "preferences"],
    content: `This is the problem in the set that is mostly about dependency direction. The thing being sent should be expressible without naming a channel, and the code that decides to notify should not change when a channel is added — the requirements say channels will be added, so this axis is stated rather than guessed.

The second theme is failure, because channels are third-party services. A design has to say what happens when one is slow or unavailable, whether the others still get their chance, and how the outcome is recorded. This is usually where an otherwise tidy design turns out to have nowhere for the answer to live.

The third is that the same notification must not be delivered twice over the same channel when a send is retried, which means something has to carry an identity for the attempt.

The fourth is preferences and opt-outs, which are rules about whether to send at all, and are easy to leave implicit.

There is no required arrangement. Ask whether a new channel would touch the sender, whether a channel failure is contained and visible, and whether a retry can duplicate a delivery.`,
  },
];

export const KNOWLEDGE_DOCUMENTS: readonly KnowledgeDocument[] = ENTRIES.map(
  (entry) => ({
    id: knowledgeDocumentId(entry.slug),
    slug: entry.slug,
    title: entry.title,
    source: entry.source,
    topic: entry.topic,
    version: KNOWLEDGE_VERSION,
    content: entry.content,
    metadata: {
      ...(entry.problemSlug === undefined
        ? {}
        : { problemSlug: entry.problemSlug }),
      concepts: entry.concepts,
    },
    createdAt: SEEDED_AT,
  }),
);
