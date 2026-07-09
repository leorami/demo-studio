import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { scanDocForBannedContent } from "../src/core/index.js";

const repoRoot = resolve(import.meta.dirname, "..");
const templatePath = resolve(repoRoot, "docs/JOURNEY_AUTHORING_TEMPLATE.md");
const readmePath = resolve(repoRoot, "README.md");

function readDoc(path: string): string {
  return readFileSync(path, "utf8");
}

function containsAll(text: string, phrases: readonly string[]): void {
  const normalized = text.toLowerCase();
  for (const phrase of phrases) {
    expect(normalized).toContain(phrase.toLowerCase());
  }
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "im",
  );
  const match = markdown.match(pattern);
  if (!match || match.index === undefined) {
    return "";
  }

  const start = match.index;
  const rest = markdown.slice(start + match[0].length);
  const nextHeading = rest.search(/^## /m);
  return nextHeading === -1
    ? markdown.slice(start)
    : markdown.slice(start, start + match[0].length + nextHeading);
}

const HOST_SPECIFIC_MARKERS = [
  "OS Lab",
  "Railway",
  "UAT",
  "Bridge Fetch",
] as const;

describe("authoring template docs contract", () => {
  it("docs/JOURNEY_AUTHORING_TEMPLATE.md exists", () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  it("template includes required authoring sections", () => {
    const template = readDoc(templatePath);

    containsAll(template, [
      "journey id",
      "title",
      "audience",
      "category",
      "purpose",
      "scenario reference",
      "reset",
      "replay",
      "privacy classification",
      "sanitization",
      "test guidance",
      "downstream ownership",
      "upstream candidate",
    ]);
  });

  it("README defines prepareDemo as a host-provided hook", () => {
    const readme = readDoc(readmePath);
    const contract = extractSection(readme, "prepareDemo host contract");

    expect(contract.length).toBeGreaterThan(0);
    expect(contract).toMatch(/prepareDemo/i);
    expect(contract).toMatch(/host-provided|downstream host|implemented by the host/i);
  });

  it("prepareDemo contract covers required host responsibilities", () => {
    const contract = extractSection(readDoc(readmePath), "prepareDemo host contract");

    containsAll(contract, [
      "setup",
      "reset",
      "replay",
      "asynchronous",
      "error",
      "idempotent",
      "overlay",
      "secrets",
      "downstream host",
      "ownership",
    ]);
  });

  it("docs reference PR #1 authoring primitives", () => {
    const template = readDoc(templatePath);
    const readme = readDoc(readmePath);
    const combined = `${template}\n${readme}`;

    containsAll(combined, [
      "JourneyAuthoringEntry",
      "assertManifestMatchesJourneys",
      "scanDocForBannedContent",
    ]);
  });

  it("new authoring docs exclude host-specific deployment assumptions", () => {
    const template = readDoc(templatePath);
    const contract = extractSection(readDoc(readmePath), "prepareDemo host contract");
    const combined = `${template}\n${contract}`;

    for (const marker of HOST_SPECIFIC_MARKERS) {
      expect(combined).not.toContain(marker);
    }
  });

  it("template and prepareDemo contract pass doc hygiene scan", () => {
    const template = readDoc(templatePath);
    const contract = extractSection(readDoc(readmePath), "prepareDemo host contract");

    expect(scanDocForBannedContent(template)).toEqual([]);
    expect(scanDocForBannedContent(contract)).toEqual([]);
  });
});
