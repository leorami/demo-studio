/**
 * @leorami/demo-studio — core (framework-neutral) exports.
 *
 * Import from "@leorami/demo-studio" for engine and types.
 * Import "@leorami/demo-studio/react" or "@leorami/demo-studio/preact" for UI.
 * Import "@leorami/demo-studio/styles.css" for the self-contained theme.
 */

export type {
  DemoScrollMode,
  DemoStep,
  DemoJourney,
  AutopilotEvent,
  AutopilotEventHandler,
  AutopilotRun,
  AutopilotNavigateOptions,
  DemoStudioAdapters,
} from "./types.js";

export {
  buildDemoPacing,
  DEFAULT_DEMO_PACING,
  DEMO_SPEED_MIN,
  DEMO_SPEED_MAX,
  DEMO_SPEED_DEFAULT,
  readingTimeMs,
  familiarityFactor,
  jitter,
} from "./pacing.js";
export type { DemoPacing, DemoPacingConfig } from "./pacing.js";

export { runAutopilot } from "./autopilot.js";
export type { AutopilotOptions } from "./autopilot.js";

export { parseRefinement, findJourneyById } from "./command-parser.js";
export type { ParsedRefinement } from "./command-parser.js";

export { ScreencastRecorder, isScreencastSupported } from "./screencast-recorder.js";
export type { ScreencastRecorderOptions, RecorderState } from "./screencast-recorder.js";

export { scrollContainerToTestId } from "./dom.js";

export { createDemoStudioController } from "./controller.js";
export type {
  DemoStudioSettings,
  DemoStudioState,
  DemoStudioActions,
  DemoStudioController,
  DemoStudioOptions,
  RunStatus,
} from "./controller.js";
