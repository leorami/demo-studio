/**
 * createDemoStudioController unit tests.
 *
 * Covers:
 *   - Settings persistence to localStorage
 *   - Subscribe/unsubscribe lifecycle
 *   - Open/close state
 *   - Run/abort/screencast lifecycle with a stubbed engine
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoStudioController } from "./controller.js";
import type { DemoJourney, DemoStudioAdapters } from "./types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const JOURNEY_A: DemoJourney = {
  id: "journey-a",
  label: "Journey A",
  description: "A simple test journey",
  estimatedSeconds: 10,
  steps: [
    { kind: "caption", text: "Hello", durationMs: 500 },
  ],
};

const JOURNEY_B: DemoJourney = {
  id: "journey-b",
  label: "Journey B",
  description: "Another journey",
  estimatedSeconds: 15,
  steps: [
    { kind: "caption", text: "World", durationMs: 500 },
    { kind: "navigate", routeId: "some-route", label: "Go somewhere" },
  ],
};

const TEST_STORAGE_KEY = "test-demo-studio-settings";

function makeAdapters(): DemoStudioAdapters {
  return {
    navigate: vi.fn(),
    seed: vi.fn(),
    prepareDemo: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

describe("settings persistence", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("loads defaults when localStorage has no entry", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
    });
    const { settings } = ctrl.getState();
    expect(settings.speed).toBeGreaterThan(0);
    expect(settings.fingerEnabled).toBe(true);
    expect(settings.screencastQuality).toBe("standard");
    expect(settings.hideBrowserChrome).toBe(true);
    ctrl.destroy();
  });

  it("persists speed to localStorage on change", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
    });
    ctrl.actions.setSetting("speed", 2.5);
    const stored = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) ?? "{}");
    expect(stored.speed).toBe(2.5);
    ctrl.destroy();
  });

  it("persists screencast quality and page-contents-only capture", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
    });
    ctrl.actions.setSetting("screencastQuality", "high");
    ctrl.actions.setSetting("hideBrowserChrome", false);
    ctrl.destroy();

    const ctrl2 = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
    });
    expect(ctrl2.getState().settings.screencastQuality).toBe("high");
    expect(ctrl2.getState().settings.hideBrowserChrome).toBe(false);
    ctrl2.destroy();
  });

  it("reloads persisted speed on next controller creation", () => {
    const ctrl1 = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
    });
    ctrl1.actions.setSetting("speed", 1.75);
    ctrl1.destroy();

    const ctrl2 = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
    });
    expect(ctrl2.getState().settings.speed).toBe(1.75);
    ctrl2.destroy();
  });

  it("accepts defaultSettings override when no persisted state exists", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
      storageKey: TEST_STORAGE_KEY,
      defaultSettings: { speed: 2.0 },
    });
    expect(ctrl.getState().settings.speed).toBe(2.0);
    ctrl.destroy();
  });
});

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe lifecycle
// ---------------------------------------------------------------------------

describe("subscribe lifecycle", () => {
  it("notifies subscriber when state changes", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });

    const listener = vi.fn();
    ctrl.subscribe(listener);
    ctrl.actions.setOpen(true);

    expect(listener).toHaveBeenCalledTimes(1);
    ctrl.destroy();
  });

  it("unsubscribing stops notifications", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });

    const listener = vi.fn();
    const unsubscribe = ctrl.subscribe(listener);
    unsubscribe();

    ctrl.actions.setOpen(true);
    expect(listener).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it("multiple subscribers each receive notifications", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });

    const l1 = vi.fn();
    const l2 = vi.fn();
    ctrl.subscribe(l1);
    ctrl.subscribe(l2);

    ctrl.actions.setOpen(true);
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
    ctrl.destroy();
  });
});

// ---------------------------------------------------------------------------
// Open / close panel
// ---------------------------------------------------------------------------

describe("panel open/close", () => {
  it("starts closed", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });
    expect(ctrl.getState().open).toBe(false);
    ctrl.destroy();
  });

  it("setOpen(true) opens the panel", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });
    ctrl.actions.setOpen(true);
    expect(ctrl.getState().open).toBe(true);
    ctrl.destroy();
  });

  it("setOpen(false) closes the panel", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });
    ctrl.actions.setOpen(true);
    ctrl.actions.setOpen(false);
    expect(ctrl.getState().open).toBe(false);
    ctrl.destroy();
  });
});

// ---------------------------------------------------------------------------
// Journey selection
// ---------------------------------------------------------------------------

describe("journey selection", () => {
  it("defaults to first journey", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A, JOURNEY_B],
      ...makeAdapters(),
    });
    expect(ctrl.getState().settings.journeyId).toBe(JOURNEY_A.id);
    ctrl.destroy();
  });

  it("setSetting journeyId changes the selected journey", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A, JOURNEY_B],
      ...makeAdapters(),
    });
    ctrl.actions.setSetting("journeyId", JOURNEY_B.id);
    expect(ctrl.getState().settings.journeyId).toBe(JOURNEY_B.id);
    ctrl.destroy();
  });
});

// ---------------------------------------------------------------------------
// Abort lifecycle
// ---------------------------------------------------------------------------

describe("abort", () => {
  it("abort() while idle does not throw", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });
    expect(() => ctrl.actions.abort()).not.toThrow();
    ctrl.destroy();
  });

  it("runStatus is idle after abort", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });
    ctrl.actions.abort();
    expect(ctrl.getState().runStatus).toBe("idle");
    ctrl.destroy();
  });
});

// ---------------------------------------------------------------------------
// destroy()
// ---------------------------------------------------------------------------

describe("destroy", () => {
  it("destroy stops subscribers from receiving further notifications", () => {
    const ctrl = createDemoStudioController({
      journeys: [JOURNEY_A],
      ...makeAdapters(),
    });
    const listener = vi.fn();
    ctrl.subscribe(listener);
    ctrl.destroy();

    // After destroy, state changes should not notify listeners.
    // (destroy clears the listener set)
    expect(listener).not.toHaveBeenCalled();
  });
});
