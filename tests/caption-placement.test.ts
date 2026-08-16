import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { READING_FINGER_Y_RATIO } from "../src/core/autopilot.js";

const repoRoot = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(repoRoot, "src/styles/demo-studio.css"), "utf8");

describe("narration caption placement", () => {
  it("keeps the CSS reading-finger token aligned with autopilot", () => {
    expect(READING_FINGER_Y_RATIO).toBe(0.62);
    expect(css).toMatch(/--demo-studio-reading-finger-y:\s*62vh/);
  });

  it("places caption pills below the reading finger and inside the viewport", () => {
    expect(css).toMatch(
      /\.demo-studio-caption-container\s*\{[^}]*top:\s*min\(/,
    );
    expect(css).toMatch(
      /\.demo-studio-caption-container\s*\{[^}]*bottom:\s*auto/,
    );
    expect(css).toMatch(
      /\.demo-studio-caption\s*\{[^}]*max-width:\s*min\(/,
    );
  });
});
