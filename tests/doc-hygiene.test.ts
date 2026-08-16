import { describe, expect, it } from "vitest";

import { scanDocForBannedContent } from "../src/core/index.js";

describe("scanDocForBannedContent", () => {
  it("passes clean docs", () => {
    const content = [
      "# Demo Studio",
      "",
      "This guide explains how to author journeys.",
      "",
      "Use placeholder IDs only.",
    ].join("\n");

    expect(scanDocForBannedContent(content)).toEqual([]);
  });

  it("catches representative secret/env/private artifact patterns", () => {
    const samples = [
      "export OPENAI_API_KEY=sk-proj-abcdefghijklmnop",
      "token=ghp_abcdefghijklmnopqrstuvwxyz123456",
      ".env.local contains secrets",
      "path: infra/.bridge-fetch-data/custody/server.custodian.sealed",
      "contact: user@example.com",
      "invite_token=abc123secretinvite",
    ];

    for (const line of samples) {
      const violations = scanDocForBannedContent(line);
      expect(violations.length).toBeGreaterThan(0);
    }
  });

  it("supports downstream custom banned patterns", () => {
    const content = "HOST_SPECIFIC_MARKER_42 appears here";

    expect(scanDocForBannedContent(content)).toEqual([]);

    const violations = scanDocForBannedContent(content, {
      additionalPatterns: [/HOST_SPECIFIC_MARKER_\d+/],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]?.pattern).toContain("HOST_SPECIFIC_MARKER");
  });
});
