export const SCREENCAST_QUALITIES = ["low", "standard", "high", "maximum"] as const;

export type ScreencastQuality = (typeof SCREENCAST_QUALITIES)[number];

export type ScreencastQualityPreset = {
  label: string;
  videoBitsPerSecond: number;
  frameRate: number;
  width: number;
  height: number;
};

export const SCREENCAST_QUALITY_PRESETS: Record<ScreencastQuality, ScreencastQualityPreset> = {
  low: {
    label: "Low (720p)",
    videoBitsPerSecond: 1_200_000,
    frameRate: 24,
    width: 1280,
    height: 720,
  },
  standard: {
    label: "Standard (1080p)",
    videoBitsPerSecond: 2_500_000,
    frameRate: 30,
    width: 1920,
    height: 1080,
  },
  high: {
    label: "High (1080p)",
    videoBitsPerSecond: 8_000_000,
    frameRate: 30,
    width: 1920,
    height: 1080,
  },
  maximum: {
    label: "Maximum (1440p)",
    videoBitsPerSecond: 16_000_000,
    frameRate: 60,
    width: 2560,
    height: 1440,
  },
};

export function resolveScreencastQuality(value: string | undefined): ScreencastQuality {
  return SCREENCAST_QUALITIES.includes(value as ScreencastQuality)
    ? (value as ScreencastQuality)
    : "standard";
}
