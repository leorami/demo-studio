import { describe, expect, it } from "vitest";

import { assertManifestMatchesJourneys } from "../src/core/index.js";

const journeys = [{ id: "journey-a" }, { id: "journey-b" }];

describe("assertManifestMatchesJourneys", () => {
  it("passes for matching journey/manifest IDs", () => {
    expect(() =>
      assertManifestMatchesJourneys(journeys, [
        { id: "journey-a" },
        { id: "journey-b" },
      ]),
    ).not.toThrow();
  });

  it("fails clearly for missing manifest entries", () => {
    expect(() =>
      assertManifestMatchesJourneys(journeys, [{ id: "journey-a" }]),
    ).toThrow(/missing manifest entr/i);
    expect(() =>
      assertManifestMatchesJourneys(journeys, [{ id: "journey-a" }]),
    ).toThrow(/journey-b/);
  });

  it("fails clearly for extra manifest entries", () => {
    expect(() =>
      assertManifestMatchesJourneys(journeys, [
        { id: "journey-a" },
        { id: "journey-b" },
        { id: "journey-c" },
      ]),
    ).toThrow(/extra manifest entr/i);
    expect(() =>
      assertManifestMatchesJourneys(journeys, [
        { id: "journey-a" },
        { id: "journey-b" },
        { id: "journey-c" },
      ]),
    ).toThrow(/journey-c/);
  });

  it("fails clearly for duplicate manifest IDs", () => {
    expect(() =>
      assertManifestMatchesJourneys(journeys, [
        { id: "journey-a" },
        { id: "journey-a" },
        { id: "journey-b" },
      ]),
    ).toThrow(/duplicate manifest/i);
    expect(() =>
      assertManifestMatchesJourneys(journeys, [
        { id: "journey-a" },
        { id: "journey-a" },
        { id: "journey-b" },
      ]),
    ).toThrow(/journey-a/);
  });
});
