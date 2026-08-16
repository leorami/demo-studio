import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const readmePath = resolve(repoRoot, "README.md");

const HOST_SPECIFIC_MARKERS = [
  "kyzmet",
  "OS Lab",
  "Railway",
  "UAT",
  "Bridge Fetch",
  "Store catalog",
  "kyzmetOS",
] as const;

function readReadme(): string {
  return readFileSync(readmePath, "utf8");
}

function containsAll(text: string, phrases: readonly string[]): void {
  const normalized = text.toLowerCase();
  for (const phrase of phrases) {
    expect(normalized).toContain(phrase.toLowerCase());
  }
}

describe("README host-agnostic upstream docs", () => {
  it("excludes host-specific deployment and product markers", () => {
    const readme = readReadme();
    const normalized = readme.toLowerCase();

    for (const marker of HOST_SPECIFIC_MARKERS) {
      expect(normalized).not.toContain(marker.toLowerCase());
    }
  });

  it("documents generic downstream host theming via CSS variable mapping", () => {
    const readme = readReadme();

    containsAll(readme, [
      "theming",
      "--demo-studio-bg",
      "host theme tokens",
      "downstream host",
    ]);
  });

  it("retains core authoring and adapter contract references", () => {
    const readme = readReadme();

    containsAll(readme, [
      "prepareDemo",
      "JourneyAuthoringEntry",
      "assertManifestMatchesJourneys",
      "scanDocForBannedContent",
    ]);
  });
});
