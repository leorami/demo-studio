/**
 * Core types for @leorami/demo-studio.
 *
 * All types are framework-neutral. The `routeId` in navigate steps is a plain
 * string so the package is decoupled from any host router's route-key type.
 */
type DemoScrollMode = "scan" | "read";
type DemoStep = {
    kind: "navigate";
    routeId: string;
    label?: string;
    hashQuery?: string;
    waitForTestId?: string;
} | {
    kind: "scroll";
    mode: DemoScrollMode;
    containerTestId?: string;
} | {
    kind: "click";
    testId: string;
    label?: string;
} | {
    kind: "caption";
    text: string;
    durationMs?: number;
} | {
    kind: "pause";
    ms: number;
} | {
    kind: "seed";
    target: string;
};
interface DemoJourney {
    id: string;
    label: string;
    description: string;
    estimatedSeconds: number;
    steps: DemoStep[];
}
type AutopilotEvent = {
    type: "move";
    x: number;
    y: number;
} | {
    type: "click";
    x: number;
    y: number;
    testId: string;
} | {
    type: "scroll";
    delta: number;
} | {
    type: "caption";
    text: string;
    durationMs: number;
} | {
    type: "caption-clear";
} | {
    type: "step-start";
    step: DemoStep;
    index: number;
} | {
    type: "done";
} | {
    type: "abort";
};
type AutopilotEventHandler = (event: AutopilotEvent) => void;
interface AutopilotRun {
    done: Promise<void>;
    abort(): void;
}
interface AutopilotNavigateOptions {
    hashQuery?: string;
}
interface DemoStudioAdapters {
    navigate: (routeId: string, options?: AutopilotNavigateOptions) => void;
    seed?: (target: string) => void;
    prepareDemo?: (journeyId: string) => void;
}

/**
 * DemoPacing — runtime port of the HumanDemo Playwright profile.
 *
 * Speed range: 0.5 (very slow) → 3.0 (near-instant, audit mode).
 */
interface DemoPacingConfig {
    wpmScan: number;
    wpmRead: number;
    dwellJitter: number;
    tickMs: number;
    microPauseChance: number;
    microPauseMs: number;
    minPageDwell: number;
    maxDwellCap: number;
    decayBase: number;
    familiarityFloor: number;
}
interface DemoPacing extends DemoPacingConfig {
    speed: number;
}
declare function buildDemoPacing(speed: number): DemoPacing;
declare const DEFAULT_DEMO_PACING: DemoPacing;
declare const DEMO_SPEED_MIN = 0.5;
declare const DEMO_SPEED_MAX = 3;
declare const DEMO_SPEED_DEFAULT = 1.5;
declare function readingTimeMs(text: string, mode: "scan" | "read", pacing: DemoPacing): number;
declare function familiarityFactor(visitCount: number, pacing: DemoPacing): number;
declare function jitter(max: number): number;

/**
 * DemoAutopilot — in-browser step runner.
 *
 * Navigation is fully delegated via the injected `navigate` adapter so this
 * module has no dependency on any host router or route-key type.
 */

interface AutopilotOptions {
    steps: DemoStep[];
    pacing?: DemoPacing;
    navigate: (routeId: string, options?: AutopilotNavigateOptions) => void;
    seed?: (target: string) => void;
    onEvent: AutopilotEventHandler;
    navigateSettleMs?: number;
    /** Max wait for click targets and optional post-navigate test ids. */
    elementWaitMs?: number;
    mainScrollTestId?: string;
}
/** Viewport-height ratio for the reading/caption finger. Keep in sync with `--demo-studio-reading-finger-y`. */
declare const READING_FINGER_Y_RATIO = 0.62;
declare function runAutopilot(opts: AutopilotOptions): AutopilotRun;

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

interface ParsedRefinement {
    steps: DemoStep[];
    speedDelta: number;
    speedAbsolute: number | undefined;
}
declare function parseRefinement(journey: DemoJourney, refinementText: string): ParsedRefinement;
declare function findJourneyById(journeys: DemoJourney[], id: string): DemoJourney | undefined;

/**
 * ScreencastRecorder — capture the browser tab as a downloadable .webm.
 *
 * Uses MediaDevices.getDisplayMedia() + MediaRecorder.
 * The user sees the browser's native share-picker (browser security requirement).
 */
type RecorderState = "idle" | "requesting" | "recording" | "stopping" | "done" | "error";
interface ScreencastRecorderOptions {
    filename?: string;
    videoBitsPerSecond?: number;
    onStateChange?: (state: RecorderState) => void;
    onError?: (error: Error) => void;
}
declare function isScreencastSupported(): boolean;
declare class ScreencastRecorder {
    private options;
    private stream;
    private mediaRecorder;
    private chunks;
    private _state;
    constructor(options?: ScreencastRecorderOptions);
    get state(): RecorderState;
    get isRecording(): boolean;
    private setState;
    start(): Promise<void>;
    stop(): Promise<void>;
    private cleanUp;
    private downloadBlob;
}

/**
 * DOM helpers — self-contained, no external dependencies.
 * Replaces @kyzmet/os-shell scrollMainScrollContainerToTestId.
 */
interface WaitForTestIdOptions {
    timeoutMs?: number;
    intervalMs?: number;
    signal?: AbortSignal;
}
declare function queryTestId(testId: string): HTMLElement | null;
declare function isElementVisible(el: HTMLElement): boolean;
/** Poll until a test id is present and visible, or timeout. */
declare function waitForTestId(testId: string, options?: WaitForTestIdOptions): Promise<HTMLElement | null>;
declare function scrollContainerToTestId(testId: string, behavior?: ScrollBehavior): void;

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

interface DemoStudioSettings {
    journeyId: string;
    speed: number;
    fingerEnabled: boolean;
    captionsEnabled: boolean;
    defaultMode: "scan" | "read";
}
type RunStatus = "idle" | "running" | "done" | "aborted" | "recording-start" | "recording";
interface DemoStudioState {
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
interface DemoStudioActions {
    setOpen(open: boolean): void;
    toggleOpen(): void;
    setSetting<K extends keyof DemoStudioSettings>(key: K, value: DemoStudioSettings[K]): void;
    setRefinementText(text: string): void;
    startRun(): Promise<void>;
    startScreencast(): Promise<void>;
    abort(): void;
}
interface DemoStudioController {
    getState(): DemoStudioState;
    subscribe(listener: () => void): () => void;
    actions: DemoStudioActions;
    destroy(): void;
}
interface DemoStudioOptions extends DemoStudioAdapters {
    journeys: DemoJourney[];
    storageKey?: string;
    mainScrollTestId?: string;
    defaultSettings?: Partial<DemoStudioSettings>;
    onRunningChange?: (running: boolean) => void;
}
declare function createDemoStudioController(opts: DemoStudioOptions): DemoStudioController;

/**
 * Generic journey authoring metadata types.
 *
 * Product-agnostic metadata for documenting, classifying, and testing demo
 * journeys in downstream host applications. These types do not embed host
 * routes, catalog entries, or environment-specific assumptions.
 */
/** Intended audience for a journey's documentation and playback context. */
type JourneyAuthoringAudience = "internal" | "external" | "developer" | "stakeholder";
/** High-level journey category for cataloging and test selection. */
type JourneyAuthoringCategory = "onboarding" | "feature-tour" | "workflow" | "regression" | "showcase";
/**
 * Privacy classification for journey content and documentation.
 *
 * Hosts use this to gate publication, redact sensitive captions, and enforce
 * doc-hygiene checks before sharing demos externally.
 */
type JourneyPrivacyClassification = "public" | "internal-only" | "sensitive" | "restricted";
/** Ownership metadata for maintenance and review routing. */
interface JourneyOwnership {
    team?: string;
    maintainer?: string;
    contact?: string;
}
/** Expectations for reset and replay behavior in downstream harnesses. */
interface JourneyResetReplayExpectation {
    requiresReset: boolean;
    idempotentReplay?: boolean;
    notes?: string;
}
/** Guidance for manual and automated verification of a journey. */
interface JourneyTestGuidance {
    smoke?: boolean;
    regression?: boolean;
    manualVerification?: string[];
    automatedChecks?: string[];
}
/**
 * Authoring record for a single demo journey.
 *
 * `id` must match the runtime `DemoJourney.id` and any host manifest entry.
 */
interface JourneyAuthoringEntry {
    id: string;
    label: string;
    description: string;
    audience: JourneyAuthoringAudience;
    category: JourneyAuthoringCategory;
    privacy: JourneyPrivacyClassification;
    ownership?: JourneyOwnership;
    resetReplay?: JourneyResetReplayExpectation;
    testGuidance?: JourneyTestGuidance;
    tags?: string[];
}

/**
 * Manifest parity assertion for journey authoring catalogs.
 */
interface JourneyIdSource {
    id: string;
}
interface ManifestIdEntry {
    id: string;
}
/**
 * Assert that manifest entries exactly match the provided journey IDs.
 *
 * Throws with explicit messages when manifest entries are missing, extra, or
 * duplicated. Journey order is not compared — only the ID sets must match.
 */
declare function assertManifestMatchesJourneys(journeys: readonly JourneyIdSource[], manifest: readonly ManifestIdEntry[]): void;

/**
 * Documentation hygiene scanner for demo-studio authoring artifacts.
 *
 * Detects representative secret, environment, and private-artifact patterns in
 * markdown and other text docs. Downstream hosts can extend detection via
 * `additionalPatterns`.
 */
interface DocHygieneViolation {
    pattern: string;
    line: number;
    excerpt: string;
}
interface DocHygieneOptions {
    /** Host-specific patterns to treat as banned content. */
    additionalPatterns?: RegExp[];
    /** Patterns that override default bans when matched on the same line. */
    allowedPatterns?: RegExp[];
}
/**
 * Scan document content for banned secret, env, and private-artifact patterns.
 *
 * Returns an empty array when the document is clean. Each violation includes
 * the matched pattern label, 1-based line number, and a trimmed excerpt.
 */
declare function scanDocForBannedContent(content: string, options?: DocHygieneOptions): DocHygieneViolation[];

export { type AutopilotEvent, type AutopilotEventHandler, type AutopilotNavigateOptions, type AutopilotOptions, type AutopilotRun, DEFAULT_DEMO_PACING, DEMO_SPEED_DEFAULT, DEMO_SPEED_MAX, DEMO_SPEED_MIN, type DemoJourney, type DemoPacing, type DemoPacingConfig, type DemoScrollMode, type DemoStep, type DemoStudioActions, type DemoStudioAdapters, type DemoStudioController, type DemoStudioOptions, type DemoStudioSettings, type DemoStudioState, type DocHygieneOptions, type DocHygieneViolation, type JourneyAuthoringAudience, type JourneyAuthoringCategory, type JourneyAuthoringEntry, type JourneyIdSource, type JourneyOwnership, type JourneyPrivacyClassification, type JourneyResetReplayExpectation, type JourneyTestGuidance, type ManifestIdEntry, type ParsedRefinement, READING_FINGER_Y_RATIO, type RecorderState, type RunStatus, ScreencastRecorder, type ScreencastRecorderOptions, type WaitForTestIdOptions, assertManifestMatchesJourneys, buildDemoPacing, createDemoStudioController, familiarityFactor, findJourneyById, isElementVisible, isScreencastSupported, jitter, parseRefinement, queryTestId, readingTimeMs, runAutopilot, scanDocForBannedContent, scrollContainerToTestId, waitForTestId };
