/**
 * ScreencastRecorder — capture the browser tab as a downloadable .webm.
 *
 * Uses MediaDevices.getDisplayMedia() + MediaRecorder.
 * The user sees the browser's native share-picker (browser security requirement).
 */

import {
  resolveScreencastQuality,
  SCREENCAST_QUALITY_PRESETS,
  type ScreencastQuality,
} from "./screencast-quality.js";

export type RecorderState = "idle" | "requesting" | "recording" | "stopping" | "done" | "error";

export interface ScreencastRecorderOptions {
  filename?: string;
  quality?: ScreencastQuality;
  hideBrowserChrome?: boolean;
  videoBitsPerSecond?: number;
  onStateChange?: (state: RecorderState) => void;
  onError?: (error: Error) => void;
}

export function isScreencastSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getDisplayMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

export class ScreencastRecorder {
  private options: ScreencastRecorderOptions;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private _state: RecorderState = "idle";
  private enteredFullscreen = false;

  constructor(options: ScreencastRecorderOptions = {}) {
    this.options = options;
  }

  get state(): RecorderState { return this._state; }
  get isRecording(): boolean { return this._state === "recording"; }

  private setState(s: RecorderState): void {
    this._state = s;
    this.options.onStateChange?.(s);
  }

  async start(): Promise<void> {
    if (!isScreencastSupported()) {
      const err = new Error("Screen recording is not supported in this browser. Try Chrome or Edge.");
      this.setState("error");
      this.options.onError?.(err);
      throw err;
    }

    if (this._state !== "idle" && this._state !== "done") {
      throw new Error(`Cannot start recording from state "${this._state}"`);
    }

    this.setState("requesting");
    this.chunks = [];
    this.enteredFullscreen = false;

    const quality = resolveScreencastQuality(this.options.quality);
    const preset = SCREENCAST_QUALITY_PRESETS[quality];
    const hideBrowserChrome = this.options.hideBrowserChrome !== false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: preset.frameRate,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          ...(hideBrowserChrome ? { displaySurface: "browser" } : {}),
        },
        audio: false,
        // Chrome-specific capture hints. Tab capture excludes bookmark / URL / tab bars.
        preferCurrentTab: hideBrowserChrome,
        selfBrowserSurface: "include",
        systemAudio: "exclude",
        monitorTypeSurfaces: hideBrowserChrome ? "exclude" : "include",
        surfaceSwitching: hideBrowserChrome ? "exclude" : "include",
      } as DisplayMediaStreamOptions);
    } catch (err) {
      this.setState("idle");
      const error = err instanceof Error ? err : new Error("Screen share cancelled or denied.");
      this.options.onError?.(error);
      throw error;
    }

    this.stream = stream;

    if (hideBrowserChrome) {
      this.enteredFullscreen = await requestPageFullscreen();
    }

    const mimeType = selectMimeType();
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: this.options.videoBitsPerSecond ?? preset.videoBitsPerSecond,
    };
    if (mimeType) recorderOptions.mimeType = mimeType;

    const recorder = new MediaRecorder(stream, recorderOptions);
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.chunks.push(e.data); };
    recorder.onstop = () => { this.downloadBlob(); this.cleanUp(); this.setState("done"); };
    recorder.onerror = (e) => {
      const msg = e instanceof ErrorEvent ? e.message : "MediaRecorder error";
      this.cleanUp();
      this.setState("error");
      this.options.onError?.(new Error(msg));
    };

    stream.getTracks().forEach((track) => {
      track.onended = () => { if (this._state === "recording") { void this.stop(); } };
    });

    recorder.start(250);
    this.setState("recording");
  }

  async stop(): Promise<void> {
    if (this._state !== "recording") return;
    this.setState("stopping");
    return new Promise<void>((resolve) => {
      if (!this.mediaRecorder) { resolve(); return; }
      const rec = this.mediaRecorder;
      const orig = rec.onstop;
      rec.onstop = (e) => { if (typeof orig === "function") orig.call(rec, e); resolve(); };
      this.mediaRecorder.stop();
    });
  }

  private cleanUp(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    if (this.enteredFullscreen) {
      this.enteredFullscreen = false;
      void exitPageFullscreen();
    }
  }

  private downloadBlob(): void {
    if (this.chunks.length === 0) return;
    const mimeType = this.mediaRecorder?.mimeType ?? "video/webm";
    const blob = new Blob(this.chunks, { type: mimeType });
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const name = `${this.options.filename ?? "demo"}-${dateSuffix()}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
}

async function requestPageFullscreen(): Promise<boolean> {
  const root = document.documentElement;
  if (document.fullscreenElement) return true;
  if (typeof root.requestFullscreen !== "function") return false;
  try {
    await root.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

async function exitPageFullscreen(): Promise<void> {
  if (!document.fullscreenElement) return;
  if (typeof document.exitFullscreen !== "function") return;
  try {
    await document.exitFullscreen();
  } catch {
    /* already left fullscreen */
  }
}

function selectMimeType(): string | undefined {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } });
}

function dateSuffix(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
