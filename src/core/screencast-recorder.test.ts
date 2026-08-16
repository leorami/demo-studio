import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreencastRecorder } from "./screencast-recorder.js";

type Track = { stop: ReturnType<typeof vi.fn>; onended: null | (() => void) };

function installCaptureMocks() {
  const track: Track = { stop: vi.fn(), onended: null };
  const stream = { getTracks: () => [track] };
  const getDisplayMedia = vi.fn().mockResolvedValue(stream);
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  const exitFullscreen = vi.fn().mockResolvedValue(undefined);

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getDisplayMedia },
  });

  class FakeMediaRecorder {
    static isTypeSupported() { return true; }
    mimeType = "video/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    start() {}
    stop() { this.onstop?.(); }
  }

  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => (requestFullscreen.mock.calls.length > exitFullscreen.mock.calls.length ? document.documentElement : null),
  });
  document.documentElement.requestFullscreen = requestFullscreen;
  document.exitFullscreen = exitFullscreen;

  return { getDisplayMedia, requestFullscreen, exitFullscreen, stream, track };
}

describe("ScreencastRecorder capture options", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers this tab and requests fullscreen when hiding browser chrome", async () => {
    const { getDisplayMedia, requestFullscreen } = installCaptureMocks();
    const recorder = new ScreencastRecorder({
      hideBrowserChrome: true,
      quality: "high",
    });

    await recorder.start();

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    const options = getDisplayMedia.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.preferCurrentTab).toBe(true);
    expect(options.monitorTypeSurfaces).toBe("exclude");
    expect((options.video as { displaySurface?: string }).displaySurface).toBe("browser");
    expect((options.video as { frameRate?: number }).frameRate).toBe(30);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    await recorder.stop();
  });

  it("allows window and screen capture when browser chrome may stay visible", async () => {
    const { getDisplayMedia, requestFullscreen } = installCaptureMocks();
    const recorder = new ScreencastRecorder({
      hideBrowserChrome: false,
      quality: "low",
    });

    await recorder.start();

    const options = getDisplayMedia.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.preferCurrentTab).toBe(false);
    expect(options.monitorTypeSurfaces).not.toBe("exclude");
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect((options.video as { frameRate?: number }).frameRate).toBe(24);
    await recorder.stop();
  });

  it("exits fullscreen on stop after a page-contents-only capture", async () => {
    const { exitFullscreen } = installCaptureMocks();
    const recorder = new ScreencastRecorder({ hideBrowserChrome: true });
    await recorder.start();
    await recorder.stop();
    expect(exitFullscreen).toHaveBeenCalled();
  });
});
