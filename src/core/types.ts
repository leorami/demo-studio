/**
 * Core types for @leorami/demo-studio.
 *
 * All types are framework-neutral. The `routeId` in navigate steps is a plain
 * string so the package is decoupled from any host router's route-key type.
 */

export type DemoScrollMode = "scan" | "read";

export type DemoStep =
  | { kind: "navigate"; routeId: string; label?: string; hashQuery?: string; waitForTestId?: string }
  | { kind: "scroll"; mode: DemoScrollMode; containerTestId?: string }
  | { kind: "click"; testId: string; label?: string }
  | { kind: "caption"; text: string; durationMs?: number }
  | { kind: "pause"; ms: number }
  | { kind: "seed"; target: string };

export interface DemoJourney {
  id: string;
  label: string;
  description: string;
  estimatedSeconds: number;
  steps: DemoStep[];
}

/**
 * An actual journey execution outcome, not owner UAT PASS or source validation.
 * "completed" only means all steps ran. For target checking, hosts must opt
 * in to strict mode and still independently validate domain assertions.
 */
export type AutopilotVerificationFailureCode =
  | "missing_click_target"
  | "missing_navigate_target"
  | "step_error";

export type AutopilotRunOutcome =
  | { status: "completed" }
  | { status: "aborted" }
  | {
      status: "failed";
      code: AutopilotVerificationFailureCode;
      stepIndex: number;
      testId?: string;
    };

export type AutopilotEvent =
  | { type: "move"; x: number; y: number }
  | { type: "click"; x: number; y: number; testId: string }
  | { type: "scroll"; delta: number }
  | { type: "caption"; text: string; durationMs: number }
  | { type: "caption-clear" }
  | { type: "step-start"; step: DemoStep; index: number }
  | { type: "done" }
  | { type: "abort" }
  | { type: "failed"; code: AutopilotVerificationFailureCode; stepIndex: number; testId?: string };

export type AutopilotEventHandler = (event: AutopilotEvent) => void;

export interface AutopilotRun {
  done: Promise<void>;
  /** Always resolves to a concrete outcome, never an implicit UAT PASS. */
  outcome: Promise<AutopilotRunOutcome>;
  abort(): void;
}

export interface AutopilotNavigateOptions {
  hashQuery?: string;
}

export interface DemoStudioAdapters {
  navigate: (routeId: string, options?: AutopilotNavigateOptions) => void;
  seed?: (target: string) => void;
  prepareDemo?: (journeyId: string) => void;
}
