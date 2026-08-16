import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAutopilot } from "./autopilot.js";
import type { AutopilotEvent } from "./types.js";

function mountButton(testId: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.setAttribute("data-testid", testId);
  el.textContent = testId;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

function collectRun(steps: Parameters<typeof runAutopilot>[0]["steps"], extra: Partial<Parameters<typeof runAutopilot>[0]> = {}) {
  const events: AutopilotEvent[] = [];
  const navigate = vi.fn();
  const run = runAutopilot({
    steps,
    navigate,
    onEvent: (event) => events.push(event),
    navigateSettleMs: 0,
    elementWaitMs: 250,
    ...extra,
  });
  return { events, navigate, run };
}

describe("runAutopilot wait and scroll behavior", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("waits for a click target that mounts after navigate", async () => {
    const clicked = vi.fn();
    setTimeout(() => {
      const button = mountButton("late-click");
      button.addEventListener("click", clicked);
    }, 50);

    const { events, run } = collectRun([{ kind: "click", testId: "late-click" }]);
    await run.done;

    expect(clicked).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "click" && event.testId === "late-click")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("warns and skips a click when the target never appears", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { events, run } = collectRun(
      [{ kind: "click", testId: "missing-click" }],
      { elementWaitMs: 80 },
    );
    await run.done;

    expect(warn).toHaveBeenCalledWith("[demo-autopilot] click target not found: missing-click");
    expect(events.some((event) => event.type === "click")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("waits for a host-provided navigate test id instead of a hardcoded mount", async () => {
    const { events, navigate, run } = collectRun([
      { kind: "navigate", routeId: "home", waitForTestId: "host-app-ready" },
    ]);
    setTimeout(() => mountButton("host-app-ready"), 40);
    await run.done;

    expect(navigate).toHaveBeenCalledWith("home", undefined);
    expect(events.some((event) => event.type === "step-start")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("does not wait for a host-specific workplace selector from hashQuery alone", async () => {
    const started = Date.now();
    const { run } = collectRun(
      [{ kind: "navigate", routeId: "home", hashQuery: "workplace=warm" }],
      { elementWaitMs: 400 },
    );
    await run.done;
    expect(Date.now() - started).toBeLessThan(300);
  });

  it("skips full-page scrolling when nothing is scrollable", async () => {
    const { events, run } = collectRun([{ kind: "scroll", mode: "scan" }]);
    await run.done;

    expect(events.some((event) => event.type === "scroll")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
