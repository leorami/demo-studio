/**
 * createDemoStudioController — framework-neutral headless store.
 *
 * Owns all orchestration previously split between DemoStudioPanel
 * (settings, localStorage, run lifecycle) and app.tsx (lifted state).
 * Components are thin renderers over getState() + actions.
 *
 * Subscribe/notify pattern compatible with React's useSyncExternalStore
 * and Preact's useReducer-based forceUpdate.
 */

import { runAutopilot } from "./autopilot.js";
import { findJourneyById, parseRefinement } from "./command-parser.js";
import { buildDemoPacing, DEMO_SPEED_DEFAULT, DEMO_SPEED_MAX, DEMO_SPEED_MIN } from "./pacing.js";
import { isScreencastSupported, ScreencastRecorder } from "./screencast-recorder.js";
import type { DemoPacing } from "./pacing.js";
import type {
  AutopilotEvent,
  AutopilotRun,
  DemoJourney,
  DemoStep,
  DemoStudioAdapters,
} from "./types.js";
import type { RecorderState } from "./screencast-recorder.js";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface DemoStudioSettings {
  journeyId: string;
  speed: number;
  fingerEnabled: boolean;
  captionsEnabled: boolean;
  defaultMode: "scan" | "read";
}

function defaultSettings(journeys: DemoJourney[]): DemoStudioSettings {
  return {
    journeyId: journeys[0]?.id ?? "",
    speed: DEMO_SPEED_DEFAULT,
    fingerEnabled: true,
    captionsEnabled: true,
    defaultMode: "scan",
  };
}

function loadSettings(storageKey: string, journeys: DemoJourney[]): DemoStudioSettings {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultSettings(journeys);
    return { ...defaultSettings(journeys), ...JSON.parse(raw) };
  } catch { return defaultSettings(journeys); }
}

function saveSettings(storageKey: string, s: DemoStudioSettings): void {
  try { window.localStorage.setItem(storageKey, JSON.stringify(s)); } catch { /* unavailable */ }
}

// ---------------------------------------------------------------------------
// Run status
// ---------------------------------------------------------------------------

export type RunStatus = "idle" | "running" | "done" | "aborted" | "recording-start" | "recording";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface DemoStudioState {
  open: boolean;
  settings: DemoStudioSettings;
  refinementText: string;
  runStatus: RunStatus;
  recorderState: RecorderState;
  errorMsg: string | null;
  stepLabel: string | null;
  autopilotEvent: AutopilotEvent | null;
  fingerVisible: boolean;
  captionsEnabled: boolean;
  running: boolean;
  recording: boolean;
  journeys: DemoJourney[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface DemoStudioActions {
  setOpen(open: boolean): void;
  toggleOpen(): void;
  setSetting<K extends keyof DemoStudioSettings>(key: K, value: DemoStudioSettings[K]): void;
  setRefinementText(text: string): void;
  startRun(): Promise<void>;
  startScreencast(): Promise<void>;
  abort(): void;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export interface DemoStudioController {
  getState(): DemoStudioState;
  subscribe(listener: () => void): () => void;
  actions: DemoStudioActions;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DemoStudioOptions extends DemoStudioAdapters {
  journeys: DemoJourney[];
  storageKey?: string;
  mainScrollTestId?: string;
  defaultSettings?: Partial<DemoStudioSettings>;
  onRunningChange?: (running: boolean) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDemoStudioController(opts: DemoStudioOptions): DemoStudioController {
  const storageKey = opts.storageKey ?? "demo-studio-settings";

  let state: DemoStudioState = (() => {
    const loaded = { ...loadSettings(storageKey, opts.journeys), ...(opts.defaultSettings ?? {}) };
    return {
      open: false,
      settings: loaded,
      refinementText: "",
      runStatus: "idle" as RunStatus,
      recorderState: "idle" as RecorderState,
      errorMsg: null,
      stepLabel: null,
      autopilotEvent: null,
      fingerVisible: loaded.fingerEnabled,
      captionsEnabled: loaded.captionsEnabled,
      running: false,
      recording: false,
      journeys: opts.journeys,
    };
  })();

  const listeners = new Set<() => void>();
  let runRef: AutopilotRun | null = null;
  let recorderRef: ScreencastRecorder | null = null;

  function notify() { for (const l of listeners) l(); }

  function setState(patch: Partial<DemoStudioState>) {
    state = { ...state, ...patch };
    notify();
  }

  function buildSteps(): { steps: DemoStep[]; pacing: DemoPacing } | null {
    const journey = findJourneyById(opts.journeys, state.settings.journeyId);
    if (!journey) return null;

    const parsed = state.refinementText.trim().length > 0
      ? parseRefinement(journey, state.refinementText)
      : { steps: journey.steps, speedDelta: 0, speedAbsolute: undefined };

    const finalSpeed = parsed.speedAbsolute !== undefined
      ? parsed.speedAbsolute
      : Math.min(Math.max(state.settings.speed + parsed.speedDelta, DEMO_SPEED_MIN), DEMO_SPEED_MAX);

    return { steps: parsed.steps, pacing: buildDemoPacing(finalSpeed) };
  }

  function handleAutopilotEvent(event: AutopilotEvent) {
    let stepLabel = state.stepLabel;
    if (event.type === "step-start") {
      const step = event.step;
      if (step.kind === "navigate") stepLabel = step.label ?? step.routeId;
      else if (step.kind === "scroll") stepLabel = `Scrolling (${step.mode})…`;
      else if (step.kind === "caption") stepLabel = step.text.length > 48 ? `${step.text.slice(0, 48)}…` : step.text;
      else if (step.kind === "click") stepLabel = step.label ?? `Click ${step.testId}`;
      else if (step.kind === "seed") stepLabel = `Prepare ${step.target}`;
    }

    let runStatus = state.runStatus;
    let running = state.running;

    if (event.type === "done") { runStatus = "done"; stepLabel = null; running = false; opts.onRunningChange?.(false); }
    if (event.type === "abort") { runStatus = "aborted"; stepLabel = null; running = false; opts.onRunningChange?.(false); }

    setState({ autopilotEvent: event, stepLabel, runStatus, running });
  }

  async function beginDemoRun(): Promise<{ steps: DemoStep[]; pacing: DemoPacing } | null> {
    const built = buildSteps();
    if (!built || built.steps.length === 0) return null;

    setState({ errorMsg: null, runStatus: "running", running: true, open: false });
    opts.onRunningChange?.(true);
    opts.prepareDemo?.(state.settings.journeyId);
    await new Promise((r) => setTimeout(r, 350));
    return built;
  }

  const actions: DemoStudioActions = {
    setOpen(open) { setState({ open }); },
    toggleOpen() { setState({ open: !state.open }); },

    setSetting(key, value) {
      const settings = { ...state.settings, [key]: value };
      saveSettings(storageKey, settings);
      const patch: Partial<DemoStudioState> = { settings };
      if (key === "fingerEnabled") patch.fingerVisible = value as boolean;
      if (key === "captionsEnabled") patch.captionsEnabled = value as boolean;
      setState(patch);
    },

    setRefinementText(text) { setState({ refinementText: text }); },

    async startRun() {
      const built = await beginDemoRun();
      if (!built) { setState({ running: false, runStatus: "idle" }); opts.onRunningChange?.(false); return; }

      const run = runAutopilot({
        steps: built.steps,
        pacing: built.pacing,
        navigate: opts.navigate,
        seed: opts.seed,
        onEvent: handleAutopilotEvent,
        mainScrollTestId: opts.mainScrollTestId,
      });
      runRef = run;
      await run.done;
    },

    async startScreencast() {
      if (!isScreencastSupported()) {
        setState({ errorMsg: "Screen recording is not available in this browser. Try Chrome or Edge." });
        return;
      }

      const built = await beginDemoRun();
      if (!built) { setState({ running: false, runStatus: "idle" }); opts.onRunningChange?.(false); return; }

      setState({ runStatus: "recording-start", recording: true });

      const recorder = new ScreencastRecorder({
        filename: `demo-${state.settings.journeyId}`,
        onStateChange: (recorderState) => setState({ recorderState }),
        onError: (err) => {
          setState({ errorMsg: err.message, runStatus: "idle", running: false, recording: false });
          opts.onRunningChange?.(false);
        },
      });
      recorderRef = recorder;

      try { await recorder.start(); } catch {
        setState({ running: false, runStatus: "idle", recording: false });
        opts.onRunningChange?.(false);
        return;
      }

      setState({ runStatus: "recording" });

      const run = runAutopilot({
        steps: built.steps,
        pacing: built.pacing,
        navigate: opts.navigate,
        seed: opts.seed,
        onEvent: handleAutopilotEvent,
        mainScrollTestId: opts.mainScrollTestId,
      });
      runRef = run;
      await run.done;
      await recorder.stop();
      setState({ recording: false });
    },

    abort() {
      runRef?.abort();
      recorderRef?.stop().catch(() => undefined);
    },
  };

  return {
    getState() { return state; },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    actions,
    destroy() { listeners.clear(); runRef?.abort(); },
  };
}
