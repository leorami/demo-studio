/**
 * DemoCommandParser — deterministic refinement grammar.
 *
 * Grammar (one instruction per line, case-insensitive):
 *   faster / slower / speed Nx      — speed adjustment
 *   skip <token>                    — remove matching steps
 *   linger on <token> / read        — set scroll mode to "read"
 *   quick <token> / scan            — set scroll mode to "scan"
 *   pause Ns                        — insert pause before matching step
 *   caption "text"                  — insert named caption
 *   click <testId>                  — insert click after last navigate
 *
 * Unrecognized lines → caption appended at end.
 */

import type { DemoJourney, DemoStep } from "./types.js";

export interface ParsedRefinement {
  steps: DemoStep[];
  speedDelta: number;
  speedAbsolute: number | undefined;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function tokenMatches(token: string, step: DemoStep): boolean {
  const t = normalize(token);
  if (step.kind === "navigate") {
    return step.routeId.toLowerCase().includes(t) || (step.label?.toLowerCase().includes(t) ?? false);
  }
  if (step.kind === "scroll") return step.containerTestId?.toLowerCase().includes(t) ?? false;
  if (step.kind === "click") {
    return step.testId.toLowerCase().includes(t) || (step.label?.toLowerCase().includes(t) ?? false);
  }
  if (step.kind === "seed") return step.target.toLowerCase().includes(t);
  return false;
}

export function parseRefinement(
  journey: DemoJourney,
  refinementText: string,
): ParsedRefinement {
  const lines = refinementText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let steps: DemoStep[] = [...journey.steps];
  let speedDelta = 0;
  let speedAbsolute: number | undefined;
  const captionAppendix: DemoStep[] = [];

  for (const line of lines) {
    const lower = normalize(line);

    if (lower === "faster") { speedDelta += 0.5; continue; }
    if (lower === "slower") { speedDelta -= 0.5; continue; }

    const speedMatch = lower.match(/^speed\s+([\d.]+)\s*x?$/);
    if (speedMatch) {
      const val = parseFloat(speedMatch[1] ?? "1.5");
      if (!isNaN(val)) speedAbsolute = Math.min(Math.max(val, 0.5), 3.0);
      continue;
    }

    const skipMatch = lower.match(/^skip\s+(.+)$/);
    if (skipMatch) {
      const token = skipMatch[1]!.trim();
      steps = steps.filter((s) => !tokenMatches(token, s));
      continue;
    }

    const lingerMatch = lower.match(/^(?:linger\s+on|read)\s+(.+)$/);
    if (lingerMatch) {
      steps = applyScrollMode(steps, lingerMatch[1]!.trim(), "read");
      continue;
    }

    const quickMatch = lower.match(/^(?:quick|scan)\s+(.+)$/);
    if (quickMatch) {
      steps = applyScrollMode(steps, quickMatch[1]!.trim(), "scan");
      continue;
    }

    const pauseMatch = lower.match(/^pause\s+([\d.]+)\s*s$/);
    if (pauseMatch) {
      const ms = Math.round(parseFloat(pauseMatch[1] ?? "1") * 1000);
      steps = [{ kind: "pause", ms }, ...steps];
      continue;
    }

    const captionMatch = line.match(/^caption\s+"(.+)"$/i);
    if (captionMatch) {
      captionAppendix.push({ kind: "caption", text: captionMatch[1]!, durationMs: 2000 });
      continue;
    }

    const clickMatch = lower.match(/^click\s+(.+)$/);
    if (clickMatch) {
      const testId = clickMatch[1]!.trim().replace(/^["']|["']$/g, "");
      const clickStep: DemoStep = { kind: "click", testId };
      const lastNavIdx = findLastNavigateIndex(steps);
      if (lastNavIdx >= 0) {
        steps = [...steps.slice(0, lastNavIdx + 1), clickStep, ...steps.slice(lastNavIdx + 1)];
      } else {
        steps = [...steps, clickStep];
      }
      continue;
    }

    captionAppendix.push({ kind: "caption", text: line, durationMs: 2000 });
  }

  return { steps: [...steps, ...captionAppendix], speedDelta, speedAbsolute };
}

function applyScrollMode(steps: DemoStep[], token: string, mode: "scan" | "read"): DemoStep[] {
  const result: DemoStep[] = [];
  let waitingForScroll = false;

  for (const step of steps) {
    if ((step.kind === "navigate" || step.kind === "click") && tokenMatches(token, step)) {
      waitingForScroll = true;
      result.push(step);
    } else if (step.kind === "scroll" && waitingForScroll) {
      result.push({ ...step, mode });
      waitingForScroll = false;
    } else {
      if (step.kind !== "caption" && step.kind !== "pause" && step.kind !== "seed") {
        waitingForScroll = false;
      }
      result.push(step);
    }
  }

  return result;
}

function findLastNavigateIndex(steps: DemoStep[]): number {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]!.kind === "navigate") return i;
  }
  return -1;
}

export function findJourneyById(journeys: DemoJourney[], id: string): DemoJourney | undefined {
  return journeys.find((j) => j.id === id);
}
