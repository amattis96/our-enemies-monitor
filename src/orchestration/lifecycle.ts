import { z } from "zod";
import { UtcTimestamp } from "../temporal/snapshots.ts";

export const COMPONENT_STATES = ["disabled", "shadow", "experimental", "active"] as const;
export type ComponentState = (typeof COMPONENT_STATES)[number];

export const LEGACY_TASK_IDS = ["task-a", "task-b", "task-c", "task-d"] as const;
export type LegacyTaskId = (typeof LEGACY_TASK_IDS)[number];

export const ComponentTransitionRecordSchema = z
  .strictObject({
    component_id: z.string().min(1).describe("Identifier of the orchestrated component."),
    from_state: z.enum(COMPONENT_STATES).describe("State prior to the transition."),
    to_state: z.enum(COMPONENT_STATES).describe("State after the transition."),
    action: z
      .enum(["register", "transition", "suspend", "resume", "rollback"])
      .describe("Lifecycle action that produced this record."),
    reason: z.string().min(1).describe("Human-readable justification for the transition."),
    actor: z.string().min(1).describe("Actor or operator initiating the transition."),
    timestamp: UtcTimestamp.describe("UTC timestamp when the transition occurred."),
  })
  .describe("Audit record of a component lifecycle transition.");
export type ComponentTransitionRecord = z.infer<typeof ComponentTransitionRecordSchema>;

export const ComponentLifecycleEntrySchema = z
  .strictObject({
    component_id: z.string().min(1).describe("Unique component identifier."),
    state: z.enum(COMPONENT_STATES).describe("Current lifecycle state of the component."),
    previous_state: z
      .enum(COMPONENT_STATES)
      .nullable()
      .describe("Previous lifecycle state used as default rollback target."),
    suspended: z
      .boolean()
      .describe("True when the component is suspended without stopping other components."),
    suspend_reason: z
      .string()
      .min(1)
      .nullable()
      .describe("Reason for suspension, or null if not suspended."),
    is_legacy_task: z
      .boolean()
      .describe("True for existing Tasks A-D that must remain uninterrupted during M8/M9."),
    updated_at: UtcTimestamp.describe("UTC timestamp of the last lifecycle update."),
    history: z
      .array(ComponentTransitionRecordSchema)
      .describe("Chronological history of transitions for this component."),
  })
  .describe("Lifecycle state and rollback metadata for an orchestrated component.");
export type ComponentLifecycleEntry = z.infer<typeof ComponentLifecycleEntrySchema>;

export const ComponentExecutionDecisionSchema = z
  .strictObject({
    component_id: z.string().min(1).describe("Component evaluated for execution."),
    allowed: z.boolean().describe("Whether the component is permitted to execute."),
    effective_mode: z
      .enum(["none", "shadow", "experimental", "active"])
      .describe("Effective execution mode."),
    mutates_production: z
      .boolean()
      .describe("True only when active or experimental with explicit opt-in."),
    reason: z.string().min(1).describe("Explanation of the execution decision."),
  })
  .describe("Execution gate decision for a component.");
export type ComponentExecutionDecision = z.infer<typeof ComponentExecutionDecisionSchema>;

const ALLOWED_FORWARD_TRANSITIONS: Readonly<Record<ComponentState, readonly ComponentState[]>> = {
  disabled: ["shadow"],
  shadow: ["disabled", "experimental"],
  experimental: ["disabled", "shadow", "active"],
  active: ["disabled", "shadow", "experimental"],
};

function nowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isLegacyTaskId(componentId: string): boolean {
  return (LEGACY_TASK_IDS as readonly string[]).includes(componentId);
}

/**
 * In-memory lifecycle registry managing M8/M9 component transitions,
 * per-component suspension, and rollback while keeping legacy Tasks A-D isolated.
 */
export class ComponentLifecycleRegistry {
  readonly #entries = new Map<string, ComponentLifecycleEntry>();

  registerComponent(
    componentId: string,
    options: {
      initialState?: ComponentState;
      actor?: string;
      reason?: string;
      timestamp?: string;
      isLegacyTask?: boolean;
    } = {},
  ): ComponentLifecycleEntry {
    if (this.#entries.has(componentId)) {
      throw new Error(`Component "${componentId}" is already registered.`);
    }
    const state = options.initialState ?? "disabled";
    const timestamp = options.timestamp ?? nowUtc();
    const actor = options.actor ?? "system";
    const reason = options.reason ?? "Initial registration";
    const entry: ComponentLifecycleEntry = ComponentLifecycleEntrySchema.parse({
      component_id: componentId,
      state,
      previous_state: null,
      suspended: false,
      suspend_reason: null,
      is_legacy_task: options.isLegacyTask ?? isLegacyTaskId(componentId),
      updated_at: timestamp,
      history: [
        {
          component_id: componentId,
          from_state: state,
          to_state: state,
          action: "register",
          reason,
          actor,
          timestamp,
        },
      ],
    });
    this.#entries.set(componentId, entry);
    return structuredClone(entry);
  }

  getComponent(componentId: string): ComponentLifecycleEntry {
    const entry = this.#entries.get(componentId);
    if (!entry) {
      throw new Error(`Unknown component "${componentId}".`);
    }
    return structuredClone(entry);
  }

  listComponents(): ComponentLifecycleEntry[] {
    return [...this.#entries.values()].map((entry) => structuredClone(entry));
  }

  transitionComponent(
    componentId: string,
    targetState: ComponentState,
    options: { reason: string; actor: string; timestamp?: string },
  ): ComponentLifecycleEntry {
    const entry = this.#entries.get(componentId);
    if (!entry) {
      throw new Error(`Unknown component "${componentId}".`);
    }
    if (entry.suspended) {
      throw new Error(
        `Cannot transition suspended component "${componentId}". Resume or rollback first.`,
      );
    }
    if (entry.state === targetState) {
      return structuredClone(entry);
    }
    const allowed = ALLOWED_FORWARD_TRANSITIONS[entry.state];
    if (!allowed.includes(targetState)) {
      throw new Error(
        `Invalid lifecycle transition for "${componentId}": ${entry.state} -> ${targetState}.`,
      );
    }
    const timestamp = options.timestamp ?? nowUtc();
    const record: ComponentTransitionRecord = {
      component_id: componentId,
      from_state: entry.state,
      to_state: targetState,
      action: "transition",
      reason: options.reason,
      actor: options.actor,
      timestamp,
    };
    entry.previous_state = entry.state;
    entry.state = targetState;
    entry.updated_at = timestamp;
    entry.history.push(record);
    return structuredClone(entry);
  }

  suspendComponent(
    componentId: string,
    reason: string,
    options: { actor?: string; timestamp?: string; rollbackState?: ComponentState } = {},
  ): ComponentLifecycleEntry {
    const entry = this.#entries.get(componentId);
    if (!entry) {
      throw new Error(`Unknown component "${componentId}".`);
    }
    if (entry.is_legacy_task) {
      throw new Error(
        `Refusing to suspend legacy task "${componentId}" via M8/M9 component control.`,
      );
    }
    const timestamp = options.timestamp ?? nowUtc();
    const actor = options.actor ?? "orchestrator";
    const targetState = options.rollbackState ?? entry.previous_state ?? "disabled";
    const record: ComponentTransitionRecord = {
      component_id: componentId,
      from_state: entry.state,
      to_state: targetState,
      action: "suspend",
      reason,
      actor,
      timestamp,
    };
    entry.previous_state = entry.state;
    entry.state = targetState;
    entry.suspended = true;
    entry.suspend_reason = reason;
    entry.updated_at = timestamp;
    entry.history.push(record);
    return structuredClone(entry);
  }

  rollbackComponent(
    componentId: string,
    reason: string,
    options: { actor?: string; timestamp?: string; targetState?: ComponentState } = {},
  ): ComponentLifecycleEntry {
    const entry = this.#entries.get(componentId);
    if (!entry) {
      throw new Error(`Unknown component "${componentId}".`);
    }
    if (entry.is_legacy_task) {
      throw new Error(
        `Refusing to roll back legacy task "${componentId}" via M8/M9 component control.`,
      );
    }
    const timestamp = options.timestamp ?? nowUtc();
    const actor = options.actor ?? "orchestrator";
    const targetState = options.targetState ?? entry.previous_state ?? "disabled";
    const record: ComponentTransitionRecord = {
      component_id: componentId,
      from_state: entry.state,
      to_state: targetState,
      action: "rollback",
      reason,
      actor,
      timestamp,
    };
    entry.previous_state = entry.state;
    entry.state = targetState;
    entry.suspended = false;
    entry.suspend_reason = null;
    entry.updated_at = timestamp;
    entry.history.push(record);
    return structuredClone(entry);
  }

  resumeComponent(
    componentId: string,
    options: { actor?: string; timestamp?: string; reason?: string; state?: ComponentState } = {},
  ): ComponentLifecycleEntry {
    const entry = this.#entries.get(componentId);
    if (!entry) {
      throw new Error(`Unknown component "${componentId}".`);
    }
    if (!entry.suspended) {
      return structuredClone(entry);
    }
    const timestamp = options.timestamp ?? nowUtc();
    const actor = options.actor ?? "orchestrator";
    const targetState = options.state ?? entry.state;
    const record: ComponentTransitionRecord = {
      component_id: componentId,
      from_state: entry.state,
      to_state: targetState,
      action: "resume",
      reason: options.reason ?? "Component resumed",
      actor,
      timestamp,
    };
    entry.state = targetState;
    entry.suspended = false;
    entry.suspend_reason = null;
    entry.updated_at = timestamp;
    entry.history.push(record);
    return structuredClone(entry);
  }

  canExecute(componentId: string): ComponentExecutionDecision {
    const entry = this.#entries.get(componentId);
    if (!entry) {
      return {
        component_id: componentId,
        allowed: false,
        effective_mode: "none",
        mutates_production: false,
        reason: `Component "${componentId}" is not registered.`,
      };
    }
    if (entry.suspended) {
      return {
        component_id: componentId,
        allowed: false,
        effective_mode: "none",
        mutates_production: false,
        reason: `Component "${componentId}" is suspended: ${entry.suspend_reason ?? "unspecified"}.`,
      };
    }
    if (entry.state === "disabled") {
      return {
        component_id: componentId,
        allowed: false,
        effective_mode: "none",
        mutates_production: false,
        reason: `Component "${componentId}" is disabled.`,
      };
    }
    return {
      component_id: componentId,
      allowed: true,
      effective_mode: entry.state,
      mutates_production: entry.state === "active" || entry.state === "experimental",
      reason: `Component "${componentId}" is running in ${entry.state} mode.`,
    };
  }

  /**
   * Verify that existing Tasks A-C remain active (and Task D remains in its
   * configured state) regardless of M8/M9 shadow/suspended components.
   */
  verifyLegacyTasksUninterrupted(): {
    uninterrupted: boolean;
    legacy_states: Record<string, { state: ComponentState; suspended: boolean }>;
  } {
    const legacyStates: Record<string, { state: ComponentState; suspended: boolean }> = {};
    let uninterrupted = true;
    for (const entry of this.#entries.values()) {
      if (!entry.is_legacy_task) continue;
      legacyStates[entry.component_id] = {
        state: entry.state,
        suspended: entry.suspended,
      };
      if (entry.suspended) {
        uninterrupted = false;
      }
      if (entry.component_id !== "task-d" && entry.state !== "active") {
        uninterrupted = false;
      }
    }
    return { uninterrupted, legacy_states: legacyStates };
  }
}

/**
 * Create the default M8/M9 lifecycle registry with Tasks A-C active, Task D
 * disabled (retired to auto-merge.yml), and new M8/M9 components in shadow mode.
 */
export function createDefaultLifecycleRegistry(timestamp?: string): ComponentLifecycleRegistry {
  const ts = timestamp ?? nowUtc();
  const registry = new ComponentLifecycleRegistry();
  registry.registerComponent("task-a", {
    initialState: "active",
    reason: "Existing OSINT & Ingest task",
    timestamp: ts,
    isLegacyTask: true,
  });
  registry.registerComponent("task-b", {
    initialState: "active",
    reason: "Existing Editorial task",
    timestamp: ts,
    isLegacyTask: true,
  });
  registry.registerComponent("task-c", {
    initialState: "active",
    reason: "Existing Review & Fix task",
    timestamp: ts,
    isLegacyTask: true,
  });
  registry.registerComponent("task-d", {
    initialState: "disabled",
    reason: "Paused in favor of auto-merge.yml",
    timestamp: ts,
    isLegacyTask: true,
  });
  registry.registerComponent("discovery-engine", {
    initialState: "shadow",
    reason: "M8/M9 deterministic discovery in shadow mode",
    timestamp: ts,
  });
  registry.registerComponent("devil-advocate", {
    initialState: "shadow",
    reason: "M8/M9 anti-anchoring critic in shadow mode",
    timestamp: ts,
  });
  registry.registerComponent("backpressure-controller", {
    initialState: "shadow",
    reason: "M9 backpressure and budget controller in shadow mode",
    timestamp: ts,
  });
  registry.registerComponent("brief-generator", {
    initialState: "shadow",
    reason: "PK-13 brief generator in shadow mode",
    timestamp: ts,
  });
  return registry;
}
