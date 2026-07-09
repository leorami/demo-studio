import { describe, expect, it } from "vitest";

import {
  assertManifestMatchesJourneys,
  scanDocForBannedContent,
} from "../src/core/index.js";
import type {
  JourneyAuthoringAudience,
  JourneyAuthoringCategory,
  JourneyAuthoringEntry,
  JourneyOwnership,
  JourneyPrivacyClassification,
  JourneyResetReplayExpectation,
  JourneyTestGuidance,
} from "../src/core/index.js";

describe("authoring types", () => {
  it("exports authoring types from package entrypoint", () => {
    const ownership: JourneyOwnership = {
      team: "demo-platform",
      maintainer: "docs-team",
    };
    const resetReplay: JourneyResetReplayExpectation = {
      requiresReset: true,
      idempotentReplay: true,
      notes: "Reset host fixture state before replay.",
    };
    const testGuidance: JourneyTestGuidance = {
      smoke: true,
      regression: false,
      manualVerification: ["Launcher opens", "Autopilot completes"],
    };

    const entry: JourneyAuthoringEntry = {
      id: "sample-tour",
      label: "Sample Tour",
      description: "Generic onboarding walkthrough for downstream hosts.",
      audience: "developer",
      category: "onboarding",
      privacy: "public",
      ownership,
      resetReplay,
      testGuidance,
      tags: ["starter"],
    };

    const audience: JourneyAuthoringAudience = "external";
    const category: JourneyAuthoringCategory = "feature-tour";
    const privacy: JourneyPrivacyClassification = "internal-only";

    expect(entry.id).toBe("sample-tour");
    expect([audience, category, privacy]).toHaveLength(3);
    expect(typeof assertManifestMatchesJourneys).toBe("function");
    expect(typeof scanDocForBannedContent).toBe("function");
  });
});
