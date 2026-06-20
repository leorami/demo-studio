/**
 * Core types for @leorami/demo-studio.
 *
 * All types are framework-neutral. The `routeId` in navigate steps is a plain
 * string so the package is decoupled from any host router's route-key type.
 */

export type DemoScrollMode = "scan" | "read";

export type DemoStep =
  | { kind: "navigate"; routeId: string; label?: string; hashQuery?: string }
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

export type AutopilotEvent =
  | { type: "move"; x: number; y: number }
  | { type: "click"; x: number; y: number; testId: string }
  | { type: "scroll"; delta: number }
  | { type: "caption"; text: string; durationMs: number }
  | { type: "caption-clear" }
  | { type: "step-start"; step: DemoStep; index: number }
  | { type: "done" }
  | { type: "abort" };

export type AutopilotEventHandler = (event: AutopilotEvent) => void;

export interface AutopilotRun {
  done: Promise<void>;
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
