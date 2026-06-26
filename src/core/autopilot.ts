/**
 * DemoAutopilot — in-browser step runner.
 *
 * Navigation is fully delegated via the injected `navigate` adapter so this
 * module has no dependency on any host router or route-key type.
 */

import { scrollContainerToTestId, waitForTestId } from "./dom.js";
import {
  buildDemoPacing,
  familiarityFactor,
  jitter,
  readingTimeMs,
  type DemoPacing,
} from "./pacing.js";
import type {
  AutopilotEvent,
  AutopilotEventHandler,
  AutopilotNavigateOptions,
  AutopilotRun,
  DemoScrollMode,
  DemoStep,
} from "./types.js";

export type { DemoPacing };

// ---------------------------------------------------------------------------
// Scroll container detection
// ---------------------------------------------------------------------------

interface ScrollGeometry {
  scrollable: number;
  fullText: string;
  container: HTMLElement | null;
}

function detectScrollContainer(
  containerTestId?: string,
  mainScrollTestId?: string,
): ScrollGeometry {
  const dist = (el: Element) => el.scrollHeight - el.clientHeight;

  const tryContainer = (el: HTMLElement | null): ScrollGeometry | null => {
    if (!el) return null;
    const scrollable = dist(el);
    if (scrollable <= 10) return null;
    el.scrollTop = 0;
    return {
      scrollable,
      fullText: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      container: el,
    };
  };

  if (containerTestId) {
    const explicit = document.querySelector(
      `[data-testid="${containerTestId}"]`,
    ) as HTMLElement | null;
    if (!explicit) {
      return { scrollable: 0, fullText: "", container: null };
    }
    const scoped = tryContainer(explicit);
    if (scoped) return scoped;
  }

  if (mainScrollTestId) {
    const main = tryContainer(
      document.querySelector(`[data-testid="${mainScrollTestId}"]`) as HTMLElement | null,
    );
    if (main) return main;
  }

  const winScrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (winScrollable > 10) {
    window.scrollTo(0, 0);
    return {
      scrollable: winScrollable,
      fullText: (document.body.textContent ?? "").replace(/\s+/g, " ").trim(),
      container: null,
    };
  }

  let bestDist = 10;
  let best: HTMLElement | null = null;
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const d = dist(el);
    if (d > bestDist) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        bestDist = d;
        best = el as HTMLElement;
      }
    }
  }
  const overflowBest = tryContainer(best);
  if (overflowBest) return overflowBest;

  window.scrollTo(0, 0);
  return {
    scrollable: 0,
    fullText: (document.body.textContent ?? "").replace(/\s+/g, " ").trim(),
    container: null,
  };
}

function scrollBy(container: HTMLElement | null, delta: number): void {
  if (container) container.scrollTop += delta;
  else window.scrollBy(0, delta);
}

function maxScrollTop(container: HTMLElement | null): number {
  if (container) return Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function currentScrollTop(container: HTMLElement | null): number {
  if (container) return container.scrollTop;
  return window.scrollY;
}

function scrollToBottom(container: HTMLElement | null): void {
  const top = maxScrollTop(container);
  if (container) container.scrollTop = top;
  else window.scrollTo(0, top);
}

function centreOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AutopilotOptions {
  steps: DemoStep[];
  pacing?: DemoPacing;
  navigate: (routeId: string, options?: AutopilotNavigateOptions) => void;
  seed?: (target: string) => void;
  onEvent: AutopilotEventHandler;
  navigateSettleMs?: number;
  /** Max wait for click targets and post-navigate warm workplace mount. */
  elementWaitMs?: number;
  mainScrollTestId?: string;
}

function readingFingerPosition(): { x: number; y: number } {
  return {
    x: Math.round(window.innerWidth * 0.55),
    y: Math.round(window.innerHeight * 0.62),
  };
}

export function runAutopilot(opts: AutopilotOptions): AutopilotRun {
  const pacing = opts.pacing ?? buildDemoPacing(1.5);
  const navigateSettleMs = opts.navigateSettleMs ?? 900;
  const elementWaitMs = opts.elementWaitMs ?? 12_000;
  const visitCounts = new Map<string, number>();

  let aborted = false;
  let resolveRun!: () => void;
  const done = new Promise<void>((res) => { resolveRun = res; });

  function emit(event: AutopilotEvent): void { opts.onEvent(event); }

  function routeKey(): string {
    try {
      const raw = new URL(window.location.href).hash ?? "";
      return raw.split("?")[0] ?? raw;
    } catch { return window.location.href; }
  }

  function sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((res) => setTimeout(res, ms));
  }

  async function runScroll(mode: DemoScrollMode, containerTestId?: string): Promise<void> {
    const { scrollable, fullText, container } = detectScrollContainer(
      containerTestId, opts.mainScrollTestId,
    );
    if (scrollable <= 0) {
      await sleep(Math.min(pacing.minPageDwell, 350));
      return;
    }
    const finger = readingFingerPosition();
    emit({ type: "move", x: finger.x, y: finger.y });

    const route = routeKey();
    const visits = visitCounts.get(route) ?? 0;
    const factor = familiarityFactor(visits, pacing);
    const rawBudget = readingTimeMs(fullText, mode, pacing);
    const budget = Math.min(Math.max(rawBudget * factor, pacing.minPageDwell), pacing.maxDwellCap);

    const pauseChance = pacing.microPauseChance * factor;
    const avgScrollMs = pacing.tickMs;
    const effectiveFraction =
      ((1 - pauseChance) * avgScrollMs) /
      ((1 - pauseChance) * avgScrollMs + pauseChance * pacing.microPauseMs);
    const adjustedBudget = budget * Math.max(effectiveFraction, 0.2);
    const scrollRate = scrollable > 0 ? scrollable / adjustedBudget : 0;

    let elapsed = 0;
    let accumulator = 0;

    while (elapsed < budget && !aborted) {
      const base = pacing.tickMs;
      const tick = base + jitter(Math.floor(base * 0.3)) - Math.floor(base * 0.15);
      const tickMs = Math.min(Math.max(tick, 20), Math.floor(base * 1.4));
      const isMicroPause = Math.random() < pauseChance;

      if (!isMicroPause && scrollRate > 0) {
        accumulator += scrollRate * tickMs;
        const delta = Math.floor(accumulator);
        accumulator -= delta;
        if (delta > 0) {
          const maxTop = maxScrollTop(container);
          const remaining = maxTop - currentScrollTop(container);
          if (remaining <= 0) break;
          const applied = Math.min(delta, remaining);
          scrollBy(container, applied);
          emit({ type: "scroll", delta: applied });
          emit({ type: "move", x: finger.x + Math.round(Math.sin(elapsed / 400) * 8), y: finger.y });
        }
      }

      const waitMs = isMicroPause
        ? Math.min(Math.max(pacing.microPauseMs + jitter(60), 100), 480)
        : tickMs;

      await sleep(waitMs);
      elapsed += waitMs;
    }

    if (!aborted && scrollable > 0) {
      const remaining = maxScrollTop(container) - currentScrollTop(container);
      if (remaining > 12) {
        scrollToBottom(container);
        await sleep(pacing.tickMs + jitter(60));
      } else {
        await sleep(80 + jitter(40));
      }
    }

    visitCounts.set(route, visits + 1);
  }

  async function runStep(step: DemoStep, index: number): Promise<void> {
    emit({ type: "step-start", step, index });

    switch (step.kind) {
      case "navigate": {
        opts.navigate(step.routeId, step.hashQuery ? { hashQuery: step.hashQuery } : undefined);
        emit({ type: "move", x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
        await sleep(navigateSettleMs);
        if (step.hashQuery?.includes("workplace=warm")) {
          await waitForTestId("kyzmet-workplace-app-host", { timeoutMs: elementWaitMs });
          await sleep(120);
        }
        break;
      }
      case "scroll": {
        await runScroll(step.mode, step.containerTestId);
        break;
      }
      case "click": {
        const el = await waitForTestId(step.testId, { timeoutMs: elementWaitMs });
        if (!el) {
          console.warn(`[demo-autopilot] click target not found: ${step.testId}`);
          break;
        }
        scrollContainerToTestId(step.testId, "instant");
        await sleep(160 + jitter(80));
        const { x, y } = centreOf(el);
        emit({ type: "move", x, y });
        await sleep(220 + jitter(120));
        emit({ type: "click", x, y, testId: step.testId });
        el.click();
        await sleep(navigateSettleMs);
        break;
      }
      case "seed": {
        opts.seed?.(step.target);
        await sleep(120);
        break;
      }
      case "caption": {
        const pos = readingFingerPosition();
        emit({ type: "move", x: pos.x, y: pos.y });
        const durationMs = step.durationMs ?? 1800;
        emit({ type: "caption", text: step.text, durationMs });
        await sleep(durationMs);
        emit({ type: "caption-clear" });
        break;
      }
      case "pause": {
        await sleep(step.ms);
        break;
      }
    }
  }

  async function runAll(): Promise<void> {
    try {
      for (let i = 0; i < opts.steps.length; i++) {
        if (aborted) break;
        await runStep(opts.steps[i]!, i);
      }
    } catch (err) {
      console.error("[demo-autopilot] step failed:", err);
      aborted = true;
    } finally {
      emit(aborted ? { type: "abort" } : { type: "done" });
      resolveRun();
    }
  }

  void runAll();

  return {
    done,
    abort() { aborted = true; },
  };
}
