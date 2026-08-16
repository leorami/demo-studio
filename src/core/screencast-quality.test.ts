import { describe, expect, it } from "vitest";
import {
  SCREENCAST_QUALITIES,
  SCREENCAST_QUALITY_PRESETS,
  resolveScreencastQuality,
} from "./screencast-quality.js";

describe("screencast quality presets", () => {
  it("exposes four operator-selectable qualities", () => {
    expect(SCREENCAST_QUALITIES).toEqual(["low", "standard", "high", "maximum"]);
  });

  it("maps each quality to bitrate, frame rate, and resolution", () => {
    expect(SCREENCAST_QUALITY_PRESETS.low.videoBitsPerSecond).toBeLessThan(
      SCREENCAST_QUALITY_PRESETS.standard.videoBitsPerSecond,
    );
    expect(SCREENCAST_QUALITY_PRESETS.standard.videoBitsPerSecond).toBeLessThan(
      SCREENCAST_QUALITY_PRESETS.high.videoBitsPerSecond,
    );
    expect(SCREENCAST_QUALITY_PRESETS.high.videoBitsPerSecond).toBeLessThan(
      SCREENCAST_QUALITY_PRESETS.maximum.videoBitsPerSecond,
    );
    expect(SCREENCAST_QUALITY_PRESETS.low.height).toBe(720);
    expect(SCREENCAST_QUALITY_PRESETS.standard.height).toBe(1080);
    expect(SCREENCAST_QUALITY_PRESETS.maximum.frameRate).toBe(60);
  });

  it("falls back to standard for unknown persisted values", () => {
    expect(resolveScreencastQuality(undefined)).toBe("standard");
    expect(resolveScreencastQuality("standard")).toBe("standard");
    expect(resolveScreencastQuality("maximum")).toBe("maximum");
    expect(resolveScreencastQuality("ultra")).toBe("standard");
  });
});
