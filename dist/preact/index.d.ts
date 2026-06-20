import * as preact from 'preact';
import { JSX } from 'preact';

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
interface AutopilotNavigateOptions {
    hashQuery?: string;
}
interface DemoStudioAdapters {
    navigate: (routeId: string, options?: AutopilotNavigateOptions) => void;
    seed?: (target: string) => void;
    prepareDemo?: (journeyId: string) => void;
}

/**
 * ScreencastRecorder — capture the browser tab as a downloadable .webm.
 *
 * Uses MediaDevices.getDisplayMedia() + MediaRecorder.
 * The user sees the browser's native share-picker (browser security requirement).
 */
type RecorderState = "idle" | "requesting" | "recording" | "stopping" | "done" | "error";

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

/**
 * Subscribe to an existing DemoStudioController and re-render on state changes.
 * Use this in components that receive a controller prop from the host application.
 */
declare function useControllerState(controller: DemoStudioController): DemoStudioState;
/**
 * Create and bind a DemoStudioController from options.
 * Use this in the all-in-one <DemoStudio> component.
 */
declare function useDemoStudio(opts: DemoStudioOptions): {
    state: DemoStudioState;
    actions: DemoStudioActions;
};

/** @jsxImportSource preact */

interface DemoStudioProps extends DemoStudioOptions {
    className?: string;
    style?: JSX.CSSProperties;
}
declare function DemoStudio({ className, style, ...opts }: DemoStudioProps): JSX.Element;

interface DemoStudioPanelProps {
    controller: DemoStudioController;
}
declare function DemoStudioPanel({ controller }: DemoStudioPanelProps): preact.JSX.Element;

interface DemoStudioLauncherProps {
    controller: DemoStudioController;
}
declare function DemoStudioLauncher({ controller }: DemoStudioLauncherProps): preact.JSX.Element;

interface DemoFingerOverlayProps {
    controller: DemoStudioController;
}
declare function DemoFingerOverlay({ controller }: DemoFingerOverlayProps): preact.JSX.Element | null;

export { DemoFingerOverlay, type DemoFingerOverlayProps, DemoStudio, type DemoStudioActions, DemoStudioLauncher, type DemoStudioLauncherProps, DemoStudioPanel, type DemoStudioPanelProps, type DemoStudioProps, type DemoStudioState, useControllerState, useDemoStudio };
