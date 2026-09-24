"use client";

import { useState } from "react";
import {
  Boxes,
  Component,
  GitBranch,
  Link2,
  Plus,
  TriangleAlert,
  Trash2,
  Waypoints,
} from "lucide-react";
import type { ComponentType } from "react";
import type { RequirementResponse } from "@/presentation/api/dto";
import {
  RELATIONSHIP_OPTIONS,
  elementNames,
  nextKey,
  toDraftState,
  toStructuredDesign,
} from "./design-model";
import type { DraftState } from "./design-model";
import type { StructuredDesign } from "@/domain/design/structured-design";

/** Singular nouns for the remove controls, so a screen reader hears "Remove class 2". */
const LABELS = {
  classes: "class",
  interfaces: "interface",
  relationships: "relationship",
  decisions: "decision",
  edgeCases: "edge case",
  mappings: "requirement mapping",
} as const;

export interface DesignEditorProps {
  readonly design: StructuredDesign | null;
  readonly requirements: readonly RequirementResponse[];
  readonly disabled?: boolean;
  readonly onChange: (design: StructuredDesign) => void;
}

/**
 * A structured editor, not a diagram tool.
 *
 * All editing is local state; the saved draft on the server stays authoritative. The
 * only validation here is the kind that helps while typing — a name that is still
 * blank — because the design rules live in the domain and duplicating them would give
 * the learner two sets of rules that drift apart.
 */
export function DesignEditor({
  design,
  requirements,
  disabled = false,
  onChange,
}: DesignEditorProps) {
  const [state, setState] = useState<DraftState>(() => toDraftState(design));

  function update(mutate: (draft: DraftState) => void): void {
    setState((current) => {
      const next = structuredClone(current);
      mutate(next);
      onChange(toStructuredDesign(next));
      return next;
    });
  }

  const names = elementNames(state);

  return (
    <div>
      <Section
        id="section-classes"
        Icon={Boxes}
        title="Classes"
        hint="What each one is responsible for matters more than how many there are."
        onAdd={
          disabled
            ? undefined
            : () =>
                update((draft) => {
                  draft.classes.push({
                    key: nextKey("class"),
                    name: "",
                    responsibility: "",
                    attributes: [],
                    methods: [],
                  });
                })
        }
      >
        {state.classes.map((definition, index) => (
          <div className="entry" key={definition.key}>
            <div className="entry-head">
              <strong>Class {index + 1}</strong>
              {!disabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${LABELS.classes} ${index + 1}`}
                  onClick={() =>
                    update((draft) => {
                      draft.classes.splice(index, 1);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="field-row">
              <label>
                Name
                <input
                  value={definition.name}
                  disabled={disabled}
                  aria-label={`Class ${index + 1} name`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.classes[index];
                      if (target !== undefined) target.name = event.target.value;
                    })
                  }
                />
                {definition.name.trim().length === 0 && (
                  <span className="field-hint">A class needs a name.</span>
                )}
              </label>
              <label>
                Responsibility
                <textarea
                  value={definition.responsibility}
                  disabled={disabled}
                  aria-label={`Class ${index + 1} responsibility`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.classes[index];
                      if (target !== undefined)
                        target.responsibility = event.target.value;
                    })
                  }
                />
              </label>
            </div>

            <NamedList
              label="Attributes"
              disabled={disabled}
              rows={definition.attributes.map((attribute) => ({
                key: attribute.key,
                first: attribute.name,
                second: attribute.type,
              }))}
              firstLabel="Name"
              secondLabel="Type"
              onAdd={() =>
                update((draft) => {
                  draft.classes[index]?.attributes.push({
                    key: nextKey("attr"),
                    name: "",
                    type: "",
                  });
                })
              }
              onChangeRow={(rowIndex, field, value) =>
                update((draft) => {
                  const row = draft.classes[index]?.attributes[rowIndex];
                  if (row === undefined) return;
                  if (field === "first") row.name = value;
                  else row.type = value;
                })
              }
              onRemove={(rowIndex) =>
                update((draft) => {
                  draft.classes[index]?.attributes.splice(rowIndex, 1);
                })
              }
            />

            <NamedList
              label="Methods"
              disabled={disabled}
              rows={definition.methods.map((method) => ({
                key: method.key,
                first: method.name,
                second: method.signature,
              }))}
              firstLabel="Name"
              secondLabel="Signature"
              onAdd={() =>
                update((draft) => {
                  draft.classes[index]?.methods.push({
                    key: nextKey("method"),
                    name: "",
                    signature: "",
                  });
                })
              }
              onChangeRow={(rowIndex, field, value) =>
                update((draft) => {
                  const row = draft.classes[index]?.methods[rowIndex];
                  if (row === undefined) return;
                  if (field === "first") row.name = value;
                  else row.signature = value;
                })
              }
              onRemove={(rowIndex) =>
                update((draft) => {
                  draft.classes[index]?.methods.splice(rowIndex, 1);
                })
              }
            />
          </div>
        ))}
      </Section>

      <Section
        id="section-interfaces"
        Icon={Component}
        title="Interfaces"
        hint="Optional. Add one where the problem states a variation it would absorb."
        onAdd={
          disabled
            ? undefined
            : () =>
                update((draft) => {
                  draft.interfaces.push({
                    key: nextKey("interface"),
                    name: "",
                    responsibility: "",
                    methods: [],
                  });
                })
        }
      >
        {state.interfaces.map((contract, index) => (
          <div className="entry" key={contract.key}>
            <div className="entry-head">
              <strong>Interface {index + 1}</strong>
              {!disabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${LABELS.interfaces} ${index + 1}`}
                  onClick={() =>
                    update((draft) => {
                      draft.interfaces.splice(index, 1);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="field-row">
              <label>
                Name
                <input
                  value={contract.name}
                  disabled={disabled}
                  aria-label={`Interface ${index + 1} name`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.interfaces[index];
                      if (target !== undefined) target.name = event.target.value;
                    })
                  }
                />
              </label>
              <label>
                Responsibility
                <textarea
                  value={contract.responsibility}
                  disabled={disabled}
                  aria-label={`Interface ${index + 1} responsibility`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.interfaces[index];
                      if (target !== undefined)
                        target.responsibility = event.target.value;
                    })
                  }
                />
              </label>
            </div>
            <NamedList
              label="Methods"
              disabled={disabled}
              rows={contract.methods.map((method) => ({
                key: method.key,
                first: method.name,
                second: method.signature,
              }))}
              firstLabel="Name"
              secondLabel="Signature"
              onAdd={() =>
                update((draft) => {
                  draft.interfaces[index]?.methods.push({
                    key: nextKey("method"),
                    name: "",
                    signature: "",
                  });
                })
              }
              onChangeRow={(rowIndex, field, value) =>
                update((draft) => {
                  const row = draft.interfaces[index]?.methods[rowIndex];
                  if (row === undefined) return;
                  if (field === "first") row.name = value;
                  else row.signature = value;
                })
              }
              onRemove={(rowIndex) =>
                update((draft) => {
                  draft.interfaces[index]?.methods.splice(rowIndex, 1);
                })
              }
            />
          </div>
        ))}
      </Section>

      <Section
        id="section-relationships"
        Icon={Waypoints}
        title="Relationships"
        hint="Endpoints must name a class or interface in this design."
        onAdd={
          disabled
            ? undefined
            : () =>
                update((draft) => {
                  draft.relationships.push({
                    key: nextKey("rel"),
                    source: "",
                    target: "",
                    type: "ASSOCIATION",
                    rationale: "",
                  });
                })
        }
      >
        {state.relationships.map((relationship, index) => (
          <div className="entry" key={relationship.key}>
            <div className="entry-head">
              <strong>Relationship {index + 1}</strong>
              {!disabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${LABELS.relationships} ${index + 1}`}
                  onClick={() =>
                    update((draft) => {
                      draft.relationships.splice(index, 1);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="field-row field-row-3">
              <label>
                Source
                <input
                  list="design-elements"
                  value={relationship.source}
                  disabled={disabled}
                  aria-label={`Relationship ${index + 1} source`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.relationships[index];
                      if (target !== undefined) target.source = event.target.value;
                    })
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={relationship.type}
                  disabled={disabled}
                  aria-label={`Relationship ${index + 1} type`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.relationships[index];
                      if (target !== undefined)
                        target.type = event.target
                          .value as DraftState["relationships"][number]["type"];
                    })
                  }
                >
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target
                <input
                  list="design-elements"
                  value={relationship.target}
                  disabled={disabled}
                  aria-label={`Relationship ${index + 1} target`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.relationships[index];
                      if (target !== undefined) target.target = event.target.value;
                    })
                  }
                />
              </label>
            </div>
            <label>
              Why this relationship exists (optional)
              <input
                value={relationship.rationale}
                disabled={disabled}
                aria-label={`Relationship ${index + 1} rationale`}
                onChange={(event) =>
                  update((draft) => {
                    const target = draft.relationships[index];
                    if (target !== undefined) target.rationale = event.target.value;
                  })
                }
              />
            </label>
          </div>
        ))}
      </Section>

      <Section
        id="section-decisions"
        Icon={GitBranch}
        title="Design decisions"
        hint="What you chose, why, and what it costs. The trade-off is the part reviewers read."
        onAdd={
          disabled
            ? undefined
            : () =>
                update((draft) => {
                  draft.decisions.push({
                    key: nextKey("decision"),
                    decision: "",
                    rationale: "",
                    tradeoff: "",
                  });
                })
        }
      >
        {state.decisions.map((decision, index) => (
          <div className="entry" key={decision.key}>
            <div className="entry-head">
              <strong>Decision {index + 1}</strong>
              {!disabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${LABELS.decisions} ${index + 1}`}
                  onClick={() =>
                    update((draft) => {
                      draft.decisions.splice(index, 1);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="field-row field-row-3">
              {(["decision", "rationale", "tradeoff"] as const).map((field) => (
                <label key={field}>
                  {field === "tradeoff" ? "Trade-off" : field === "decision" ? "Decision" : "Rationale"}
                  <textarea
                    value={decision[field]}
                    disabled={disabled}
                    aria-label={`Decision ${index + 1} ${field}`}
                    onChange={(event) =>
                      update((draft) => {
                        const target = draft.decisions[index];
                        if (target !== undefined) target[field] = event.target.value;
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section
        id="section-edge-cases"
        Icon={TriangleAlert}
        title="Edge cases"
        hint="The situation, and what the design does about it."
        onAdd={
          disabled
            ? undefined
            : () =>
                update((draft) => {
                  draft.edgeCases.push({
                    key: nextKey("edge"),
                    description: "",
                    expectedBehavior: "",
                  });
                })
        }
      >
        {state.edgeCases.map((edgeCase, index) => (
          <div className="entry" key={edgeCase.key}>
            <div className="entry-head">
              <strong>Edge case {index + 1}</strong>
              {!disabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${LABELS.edgeCases} ${index + 1}`}
                  onClick={() =>
                    update((draft) => {
                      draft.edgeCases.splice(index, 1);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="field-row">
              <label>
                Situation
                <textarea
                  value={edgeCase.description}
                  disabled={disabled}
                  aria-label={`Edge case ${index + 1} situation`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.edgeCases[index];
                      if (target !== undefined)
                        target.description = event.target.value;
                    })
                  }
                />
              </label>
              <label>
                Expected behaviour
                <textarea
                  value={edgeCase.expectedBehavior}
                  disabled={disabled}
                  aria-label={`Edge case ${index + 1} expected behaviour`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.edgeCases[index];
                      if (target !== undefined)
                        target.expectedBehavior = event.target.value;
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </Section>

      <Section
        id="section-requirement-mapping"
        Icon={Link2}
        title="Requirement mapping"
        hint="Point each requirement at the element that satisfies it. This is what makes the review possible."
        onAdd={
          disabled
            ? undefined
            : () =>
                update((draft) => {
                  draft.mappings.push({
                    key: nextKey("mapping"),
                    requirementId: requirements[0]?.id ?? "",
                    entities: "",
                    note: "",
                    loaded: [],
                  });
                })
        }
      >
        {state.mappings.map((mapping, index) => (
          <div className="entry" key={mapping.key}>
            <div className="entry-head">
              <strong>Mapping {index + 1}</strong>
              {!disabled && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${LABELS.mappings} ${index + 1}`}
                  onClick={() =>
                    update((draft) => {
                      draft.mappings.splice(index, 1);
                    })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="field-row">
              <label>
                Requirement
                <select
                  value={mapping.requirementId}
                  disabled={disabled}
                  aria-label={`Mapping ${index + 1} requirement`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.mappings[index];
                      if (target !== undefined)
                        target.requirementId = event.target.value;
                    })
                  }
                >
                  <option value="">Choose a requirement…</option>
                  {requirements.map((requirement) => (
                    <option key={requirement.id} value={requirement.id}>
                      {requirement.code} — {requirement.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Elements that satisfy it (comma separated)
                <input
                  list="design-elements"
                  value={mapping.entities}
                  disabled={disabled}
                  aria-label={`Mapping ${index + 1} elements`}
                  onChange={(event) =>
                    update((draft) => {
                      const target = draft.mappings[index];
                      if (target !== undefined) target.entities = event.target.value;
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </Section>

      <datalist id="design-elements">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}

function Section({
  id,
  title,
  hint,
  Icon,
  onAdd,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  readonly onAdd: (() => void) | undefined;
  readonly children: React.ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : children !== null;

  return (
    <section className="section" id={id}>
      <div className="section-head">
        <h3>
          <Icon size={17} strokeWidth={1.75} />
          {title}
        </h3>
        {onAdd !== undefined && (
          <button type="button" className="btn btn-small" onClick={onAdd}>
            <Plus aria-hidden="true" />
            Add
          </button>
        )}
      </div>
      <p className="section-note spaced">
        {hint}
      </p>
      {hasRows ? (
        <div className="entry-list">{children}</div>
      ) : (
        <p className="section-note">Nothing added yet.</p>
      )}
    </section>
  );
}

function NamedList({
  label,
  rows,
  firstLabel,
  secondLabel,
  disabled,
  onAdd,
  onChangeRow,
  onRemove,
}: {
  readonly label: string;
  readonly rows: readonly { key: string; first: string; second: string }[];
  readonly firstLabel: string;
  readonly secondLabel: string;
  readonly disabled: boolean;
  readonly onAdd: () => void;
  readonly onChangeRow: (index: number, field: "first" | "second", value: string) => void;
  readonly onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="subfield">
      <legend>{label}</legend>
      <div className="entry-list">
        {rows.length === 0 && <p className="section-note">None.</p>}
        {rows.map((row, index) => (
          <div className="item-row" key={row.key}>
            <input
              type="text"
              value={row.first}
              disabled={disabled}
              placeholder={firstLabel}
              aria-label={`${label} ${index + 1} ${firstLabel}`}
              onChange={(event) => onChangeRow(index, "first", event.target.value)}
            />
            <input
              type="text"
              value={row.second}
              disabled={disabled}
              placeholder={secondLabel}
              aria-label={`${label} ${index + 1} ${secondLabel}`}
              onChange={(event) => onChangeRow(index, "second", event.target.value)}
            />
            {!disabled && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${label.toLowerCase().replace(/s$/u, "")} ${index + 1}`}
                onClick={() => onRemove(index)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" className="btn btn-small" onClick={onAdd}>
            <Plus aria-hidden="true" />
            Add {label.toLowerCase().replace(/s$/u, "")}
          </button>
        )}
      </div>
    </fieldset>
  );
}
