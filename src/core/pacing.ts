/**
 * DemoPacing — runtime port of the HumanDemo Playwright profile.
 *
 * Speed range: 0.5 (very slow) → 3.0 (near-instant, audit mode).
 */

export interface DemoPacingConfig {
  wpmScan: number;
  wpmRead: number;
  dwellJitter: number;
  tickMs: number;
  microPauseChance: number;
  microPauseMs: number;
  minPageDwell: number;
  maxDwellCap: number;
  decayBase: number;
  familiarityFloor: number;
}

const BASE_PACING: DemoPacingConfig = {
  wpmScan: 320,
  wpmRead: 200,
  dwellJitter: 280,
  tickMs: 70,
  microPauseChance: 0.14,
  microPauseMs: 340,
  minPageDwell: 500,
  maxDwellCap: 4000,
  decayBase: 0.45,
  familiarityFloor: 0.15,
};

export interface DemoPacing extends DemoPacingConfig {
  speed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function buildDemoPacing(speed: number): DemoPacing {
  const s = clamp(speed, 0.5, 3.0);
  return {
    speed: s,
    wpmScan: Math.round(BASE_PACING.wpmScan * s),
    wpmRead: Math.round(BASE_PACING.wpmRead * s),
    dwellJitter: Math.round(BASE_PACING.dwellJitter / s),
    tickMs: Math.round(BASE_PACING.tickMs / s),
    microPauseChance: BASE_PACING.microPauseChance,
    microPauseMs: Math.round(BASE_PACING.microPauseMs / s),
    minPageDwell: Math.round(BASE_PACING.minPageDwell / s),
    maxDwellCap: Math.round(BASE_PACING.maxDwellCap / s),
    decayBase: BASE_PACING.decayBase,
    familiarityFloor: BASE_PACING.familiarityFloor,
  };
}

export const DEFAULT_DEMO_PACING: DemoPacing = buildDemoPacing(1.5);
export const DEMO_SPEED_MIN = 0.5;
export const DEMO_SPEED_MAX = 3.0;
export const DEMO_SPEED_DEFAULT = 1.5;

export function readingTimeMs(
  text: string,
  mode: "scan" | "read",
  pacing: DemoPacing,
): number {
  const wpm = mode === "read" ? pacing.wpmRead : pacing.wpmScan;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const rawMs = (words / wpm) * 60_000;
  return clamp(rawMs, pacing.minPageDwell, pacing.maxDwellCap);
}

export function familiarityFactor(visitCount: number, pacing: DemoPacing): number {
  return clamp(pacing.decayBase ** visitCount, pacing.familiarityFloor, 1);
}

export function jitter(max: number): number {
  return Math.floor(Math.random() * max);
}
