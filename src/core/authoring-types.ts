/**
 * Generic journey authoring metadata types.
 *
 * Product-agnostic metadata for documenting, classifying, and testing demo
 * journeys in downstream host applications. These types do not embed host
 * routes, catalog entries, or environment-specific assumptions.
 */

/** Intended audience for a journey's documentation and playback context. */
export type JourneyAuthoringAudience =
  | "internal"
  | "external"
  | "developer"
  | "stakeholder";

/** High-level journey category for cataloging and test selection. */
export type JourneyAuthoringCategory =
  | "onboarding"
  | "feature-tour"
  | "workflow"
  | "regression"
  | "showcase";

/**
 * Privacy classification for journey content and documentation.
 *
 * Hosts use this to gate publication, redact sensitive captions, and enforce
 * doc-hygiene checks before sharing demos externally.
 */
export type JourneyPrivacyClassification =
  | "public"
  | "internal-only"
  | "sensitive"
  | "restricted";

/** Ownership metadata for maintenance and review routing. */
export interface JourneyOwnership {
  team?: string;
  maintainer?: string;
  contact?: string;
}

/** Expectations for reset and replay behavior in downstream harnesses. */
export interface JourneyResetReplayExpectation {
  requiresReset: boolean;
  idempotentReplay?: boolean;
  notes?: string;
}

/** Guidance for manual and automated verification of a journey. */
export interface JourneyTestGuidance {
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
export interface JourneyAuthoringEntry {
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
