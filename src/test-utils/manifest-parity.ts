/**
 * Manifest parity assertion for journey authoring catalogs.
 */

export interface JourneyIdSource {
  id: string;
}

export interface ManifestIdEntry {
  id: string;
}

function collectDuplicateIds(entries: readonly ManifestIdEntry[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id);
      continue;
    }
    seen.add(entry.id);
  }

  return [...duplicates].sort();
}

/**
 * Assert that manifest entries exactly match the provided journey IDs.
 *
 * Throws with explicit messages when manifest entries are missing, extra, or
 * duplicated. Journey order is not compared — only the ID sets must match.
 */
export function assertManifestMatchesJourneys(
  journeys: readonly JourneyIdSource[],
  manifest: readonly ManifestIdEntry[],
): void {
  const duplicateIds = collectDuplicateIds(manifest);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate manifest IDs: ${duplicateIds.join(", ")}`,
    );
  }

  const journeyIds = new Set(journeys.map((journey) => journey.id));
  const manifestIds = new Set(manifest.map((entry) => entry.id));

  const missingManifestEntries = [...journeyIds]
    .filter((id) => !manifestIds.has(id))
    .sort();
  if (missingManifestEntries.length > 0) {
    throw new Error(
      `Missing manifest entries for journey IDs: ${missingManifestEntries.join(", ")}`,
    );
  }

  const extraManifestEntries = [...manifestIds]
    .filter((id) => !journeyIds.has(id))
    .sort();
  if (extraManifestEntries.length > 0) {
    throw new Error(
      `Extra manifest entries with no matching journey: ${extraManifestEntries.join(", ")}`,
    );
  }
}
