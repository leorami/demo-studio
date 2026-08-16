import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("release documentation", () => {
  it("keeps a changelog with 0.3.0 notes", () => {
    expect(existsSync(resolve(repoRoot, "CHANGELOG.md"))).toBe(true);
    const changelog = read("CHANGELOG.md");
    expect(changelog).toMatch(/## \[0\.3\.0\]/);
    expect(changelog.toLowerCase()).toContain("waitfortestid");
    expect(changelog.toLowerCase()).toContain("screencast quality");
  });

  it("README documents targeting, settings, and screencast presets", () => {
    const readme = read("README.md");
    expect(readme).toContain("CHANGELOG.md");
    expect(readme).toContain("screencastQuality");
    expect(readme).toContain("hideBrowserChrome");
    expect(readme).toContain("waitForTestId");
    expect(readme).toMatch(/Persisted settings/i);
  });
});
