// src/preact/use-demo-studio.ts
import { useEffect, useReducer, useRef } from "preact/hooks";

// src/core/dom.ts
function queryTestId(testId) {
  return document.querySelector(
    `[data-testid="${testId}"]`
  );
}
function isElementVisible(el) {
  if (!el.isConnected) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return true;
  return el.matches("button, a, input, select, textarea, [role='button']");
}
async function waitForTestId(testId, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1e4;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (options.signal?.aborted) return null;
    const el = queryTestId(testId);
    if (el && isElementVisible(el)) return el;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const last = queryTestId(testId);
  return last && isElementVisible(last) ? last : null;
}
function scrollContainerToTestId(testId, behavior = "smooth") {
  const el = document.querySelector(
    `[data-testid="${testId}"]`
  );
  if (!el) return;
  el.scrollIntoView?.({ behavior, block: "nearest" });
}

// src/core/pacing.ts
var BASE_PACING = {
  wpmScan: 320,
  wpmRead: 200,
  dwellJitter: 280,
  tickMs: 70,
  microPauseChance: 0.14,
  microPauseMs: 340,
  minPageDwell: 500,
  maxDwellCap: 4e3,
  decayBase: 0.45,
  familiarityFloor: 0.15
};
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function buildDemoPacing(speed) {
  const s = clamp(speed, 0.5, 3);
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
    familiarityFloor: BASE_PACING.familiarityFloor
  };
}
var DEFAULT_DEMO_PACING = buildDemoPacing(1.5);
var DEMO_SPEED_MIN = 0.5;
var DEMO_SPEED_MAX = 3;
var DEMO_SPEED_DEFAULT = 1.5;
function readingTimeMs(text, mode, pacing) {
  const wpm = mode === "read" ? pacing.wpmRead : pacing.wpmScan;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const rawMs = words / wpm * 6e4;
  return clamp(rawMs, pacing.minPageDwell, pacing.maxDwellCap);
}
function familiarityFactor(visitCount, pacing) {
  return clamp(pacing.decayBase ** visitCount, pacing.familiarityFloor, 1);
}
function jitter(max) {
  return Math.floor(Math.random() * max);
}

// src/core/autopilot.ts
function detectScrollContainer(containerTestId, mainScrollTestId) {
  const dist = (el) => el.scrollHeight - el.clientHeight;
  const tryContainer = (el) => {
    if (!el) return null;
    const scrollable = dist(el);
    if (scrollable <= 10) return null;
    el.scrollTop = 0;
    return {
      scrollable,
      fullText: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
      container: el
    };
  };
  if (containerTestId) {
    const explicit = document.querySelector(
      `[data-testid="${containerTestId}"]`
    );
    if (!explicit) {
      return { scrollable: 0, fullText: "", container: null };
    }
    const scoped = tryContainer(explicit);
    if (scoped) return scoped;
  }
  if (mainScrollTestId) {
    const main = tryContainer(
      document.querySelector(`[data-testid="${mainScrollTestId}"]`)
    );
    if (main) return main;
  }
  const winScrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (winScrollable > 10) {
    window.scrollTo(0, 0);
    return {
      scrollable: winScrollable,
      fullText: (document.body.textContent ?? "").replace(/\s+/g, " ").trim(),
      container: null
    };
  }
  let bestDist = 10;
  let best = null;
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const d = dist(el);
    if (d > bestDist) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        bestDist = d;
        best = el;
      }
    }
  }
  const overflowBest = tryContainer(best);
  if (overflowBest) return overflowBest;
  window.scrollTo(0, 0);
  return {
    scrollable: 0,
    fullText: (document.body.textContent ?? "").replace(/\s+/g, " ").trim(),
    container: null
  };
}
function scrollBy(container, delta) {
  if (container) container.scrollTop += delta;
  else window.scrollBy(0, delta);
}
function maxScrollTop(container) {
  if (container) return Math.max(0, container.scrollHeight - container.clientHeight);
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}
function currentScrollTop(container) {
  if (container) return container.scrollTop;
  return window.scrollY;
}
function scrollToBottom(container) {
  const top = maxScrollTop(container);
  if (container) container.scrollTop = top;
  else window.scrollTo(0, top);
}
function centreOf(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}
var READING_FINGER_Y_RATIO = 0.62;
function readingFingerPosition() {
  return {
    x: Math.round(window.innerWidth * 0.55),
    y: Math.round(window.innerHeight * READING_FINGER_Y_RATIO)
  };
}
function runAutopilot(opts) {
  const pacing = opts.pacing ?? buildDemoPacing(1.5);
  const navigateSettleMs = opts.navigateSettleMs ?? 900;
  const elementWaitMs = opts.elementWaitMs ?? 12e3;
  const visitCounts = /* @__PURE__ */ new Map();
  const abortController = new AbortController();
  let aborted = false;
  let resolveRun;
  const done = new Promise((res) => {
    resolveRun = res;
  });
  function emit(event) {
    opts.onEvent(event);
  }
  function routeKey() {
    try {
      const raw = new URL(window.location.href).hash ?? "";
      return raw.split("?")[0] ?? raw;
    } catch {
      return window.location.href;
    }
  }
  function sleep(ms) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((res) => setTimeout(res, ms));
  }
  async function runScroll(mode, containerTestId) {
    const { scrollable, fullText, container } = detectScrollContainer(
      containerTestId,
      opts.mainScrollTestId
    );
    if (scrollable <= 0) {
      await sleep(Math.min(pacing.minPageDwell, 350));
      return;
    }
    const finger = readingFingerPosition();
    emit({ type: "move", x: finger.x, y: finger.y });
    const route = routeKey();
    const visits = visitCounts.get(route) ?? 0;
    const factor = familiarityFactor(visits, pacing);
    const rawBudget = readingTimeMs(fullText, mode, pacing);
    const budget = Math.min(Math.max(rawBudget * factor, pacing.minPageDwell), pacing.maxDwellCap);
    const pauseChance = pacing.microPauseChance * factor;
    const avgScrollMs = pacing.tickMs;
    const effectiveFraction = (1 - pauseChance) * avgScrollMs / ((1 - pauseChance) * avgScrollMs + pauseChance * pacing.microPauseMs);
    const adjustedBudget = budget * Math.max(effectiveFraction, 0.2);
    const scrollRate = scrollable > 0 ? scrollable / adjustedBudget : 0;
    let elapsed = 0;
    let accumulator = 0;
    while (elapsed < budget && !aborted) {
      const base = pacing.tickMs;
      const tick = base + jitter(Math.floor(base * 0.3)) - Math.floor(base * 0.15);
      const tickMs = Math.min(Math.max(tick, 20), Math.floor(base * 1.4));
      const isMicroPause = Math.random() < pauseChance;
      if (!isMicroPause && scrollRate > 0) {
        accumulator += scrollRate * tickMs;
        const delta = Math.floor(accumulator);
        accumulator -= delta;
        if (delta > 0) {
          const maxTop = maxScrollTop(container);
          const remaining = maxTop - currentScrollTop(container);
          if (remaining <= 0) break;
          const applied = Math.min(delta, remaining);
          scrollBy(container, applied);
          emit({ type: "scroll", delta: applied });
          emit({ type: "move", x: finger.x + Math.round(Math.sin(elapsed / 400) * 8), y: finger.y });
        }
      }
      const waitMs = isMicroPause ? Math.min(Math.max(pacing.microPauseMs + jitter(60), 100), 480) : tickMs;
      await sleep(waitMs);
      elapsed += waitMs;
    }
    if (!aborted && scrollable > 0) {
      const remaining = maxScrollTop(container) - currentScrollTop(container);
      if (remaining > 12) {
        scrollToBottom(container);
        await sleep(pacing.tickMs + jitter(60));
      } else {
        await sleep(80 + jitter(40));
      }
    }
    visitCounts.set(route, visits + 1);
  }
  async function runStep(step, index) {
    emit({ type: "step-start", step, index });
    switch (step.kind) {
      case "navigate": {
        opts.navigate(step.routeId, step.hashQuery ? { hashQuery: step.hashQuery } : void 0);
        emit({ type: "move", x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
        await sleep(navigateSettleMs);
        if (step.waitForTestId) {
          await waitForTestId(step.waitForTestId, {
            timeoutMs: elementWaitMs,
            signal: abortController.signal
          });
        }
        break;
      }
      case "scroll": {
        await runScroll(step.mode, step.containerTestId);
        break;
      }
      case "click": {
        const el = await waitForTestId(step.testId, {
          timeoutMs: elementWaitMs,
          signal: abortController.signal
        });
        if (!el || aborted) {
          if (!el && !aborted) {
            console.warn(`[demo-autopilot] click target not found: ${step.testId}`);
          }
          break;
        }
        scrollContainerToTestId(step.testId, "instant");
        await sleep(160 + jitter(80));
        const { x, y } = centreOf(el);
        emit({ type: "move", x, y });
        await sleep(220 + jitter(120));
        emit({ type: "click", x, y, testId: step.testId });
        el.click();
        await sleep(navigateSettleMs);
        break;
      }
      case "seed": {
        opts.seed?.(step.target);
        await sleep(120);
        break;
      }
      case "caption": {
        const pos = readingFingerPosition();
        emit({ type: "move", x: pos.x, y: pos.y });
        const durationMs = step.durationMs ?? 1800;
        emit({ type: "caption", text: step.text, durationMs });
        await sleep(durationMs);
        emit({ type: "caption-clear" });
        break;
      }
      case "pause": {
        await sleep(step.ms);
        break;
      }
    }
  }
  async function runAll() {
    try {
      for (let i = 0; i < opts.steps.length; i++) {
        if (aborted) break;
        await runStep(opts.steps[i], i);
      }
    } catch (err) {
      console.error("[demo-autopilot] step failed:", err);
      aborted = true;
    } finally {
      emit(aborted ? { type: "abort" } : { type: "done" });
      resolveRun();
    }
  }
  void runAll();
  return {
    done,
    abort() {
      aborted = true;
      abortController.abort();
    }
  };
}

// src/core/command-parser.ts
function normalize(s) {
  return s.toLowerCase().trim();
}
function tokenMatches(token, step) {
  const t = normalize(token);
  if (step.kind === "navigate") {
    return step.routeId.toLowerCase().includes(t) || (step.label?.toLowerCase().includes(t) ?? false);
  }
  if (step.kind === "scroll") return step.containerTestId?.toLowerCase().includes(t) ?? false;
  if (step.kind === "click") {
    return step.testId.toLowerCase().includes(t) || (step.label?.toLowerCase().includes(t) ?? false);
  }
  if (step.kind === "seed") return step.target.toLowerCase().includes(t);
  return false;
}
function parseRefinement(journey, refinementText) {
  const lines = refinementText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let steps = [...journey.steps];
  let speedDelta = 0;
  let speedAbsolute;
  const captionAppendix = [];
  for (const line of lines) {
    const lower = normalize(line);
    if (lower === "faster") {
      speedDelta += 0.5;
      continue;
    }
    if (lower === "slower") {
      speedDelta -= 0.5;
      continue;
    }
    const speedMatch = lower.match(/^speed\s+([\d.]+)\s*x?$/);
    if (speedMatch) {
      const val = parseFloat(speedMatch[1] ?? "1.5");
      if (!isNaN(val)) speedAbsolute = Math.min(Math.max(val, 0.5), 3);
      continue;
    }
    const skipMatch = lower.match(/^skip\s+(.+)$/);
    if (skipMatch) {
      const token = skipMatch[1].trim();
      steps = steps.filter((s) => !tokenMatches(token, s));
      continue;
    }
    const lingerMatch = lower.match(/^(?:linger\s+on|read)\s+(.+)$/);
    if (lingerMatch) {
      steps = applyScrollMode(steps, lingerMatch[1].trim(), "read");
      continue;
    }
    const quickMatch = lower.match(/^(?:quick|scan)\s+(.+)$/);
    if (quickMatch) {
      steps = applyScrollMode(steps, quickMatch[1].trim(), "scan");
      continue;
    }
    const pauseMatch = lower.match(/^pause\s+([\d.]+)\s*s$/);
    if (pauseMatch) {
      const ms = Math.round(parseFloat(pauseMatch[1] ?? "1") * 1e3);
      steps = [{ kind: "pause", ms }, ...steps];
      continue;
    }
    const captionMatch = line.match(/^caption\s+"(.+)"$/i);
    if (captionMatch) {
      captionAppendix.push({ kind: "caption", text: captionMatch[1], durationMs: 2e3 });
      continue;
    }
    const clickMatch = lower.match(/^click\s+(.+)$/);
    if (clickMatch) {
      const testId = clickMatch[1].trim().replace(/^["']|["']$/g, "");
      const clickStep = { kind: "click", testId };
      const lastNavIdx = findLastNavigateIndex(steps);
      if (lastNavIdx >= 0) {
        steps = [...steps.slice(0, lastNavIdx + 1), clickStep, ...steps.slice(lastNavIdx + 1)];
      } else {
        steps = [...steps, clickStep];
      }
      continue;
    }
    captionAppendix.push({ kind: "caption", text: line, durationMs: 2e3 });
  }
  return { steps: [...steps, ...captionAppendix], speedDelta, speedAbsolute };
}
function applyScrollMode(steps, token, mode) {
  const result = [];
  let waitingForScroll = false;
  for (const step of steps) {
    if ((step.kind === "navigate" || step.kind === "click") && tokenMatches(token, step)) {
      waitingForScroll = true;
      result.push(step);
    } else if (step.kind === "scroll" && waitingForScroll) {
      result.push({ ...step, mode });
      waitingForScroll = false;
    } else {
      if (step.kind !== "caption" && step.kind !== "pause" && step.kind !== "seed") {
        waitingForScroll = false;
      }
      result.push(step);
    }
  }
  return result;
}
function findLastNavigateIndex(steps) {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "navigate") return i;
  }
  return -1;
}
function findJourneyById(journeys, id) {
  return journeys.find((j) => j.id === id);
}

// src/core/screencast-quality.ts
var SCREENCAST_QUALITIES = ["low", "standard", "high", "maximum"];
var SCREENCAST_QUALITY_PRESETS = {
  low: {
    label: "Low (720p)",
    videoBitsPerSecond: 12e5,
    frameRate: 24,
    width: 1280,
    height: 720
  },
  standard: {
    label: "Standard (1080p)",
    videoBitsPerSecond: 25e5,
    frameRate: 30,
    width: 1920,
    height: 1080
  },
  high: {
    label: "High (1080p)",
    videoBitsPerSecond: 8e6,
    frameRate: 30,
    width: 1920,
    height: 1080
  },
  maximum: {
    label: "Maximum (1440p)",
    videoBitsPerSecond: 16e6,
    frameRate: 60,
    width: 2560,
    height: 1440
  }
};
function resolveScreencastQuality(value) {
  return SCREENCAST_QUALITIES.includes(value) ? value : "standard";
}

// src/core/screencast-recorder.ts
function isScreencastSupported() {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getDisplayMedia === "function" && typeof MediaRecorder !== "undefined";
}
var ScreencastRecorder = class {
  options;
  stream = null;
  mediaRecorder = null;
  chunks = [];
  _state = "idle";
  enteredFullscreen = false;
  constructor(options = {}) {
    this.options = options;
  }
  get state() {
    return this._state;
  }
  get isRecording() {
    return this._state === "recording";
  }
  setState(s) {
    this._state = s;
    this.options.onStateChange?.(s);
  }
  async start() {
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
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: preset.frameRate,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          ...hideBrowserChrome ? { displaySurface: "browser" } : {}
        },
        audio: false,
        // Chrome-specific capture hints. Tab capture excludes bookmark / URL / tab bars.
        preferCurrentTab: hideBrowserChrome,
        selfBrowserSurface: "include",
        systemAudio: "exclude",
        monitorTypeSurfaces: hideBrowserChrome ? "exclude" : "include",
        surfaceSwitching: hideBrowserChrome ? "exclude" : "include"
      });
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
    const recorderOptions = {
      videoBitsPerSecond: this.options.videoBitsPerSecond ?? preset.videoBitsPerSecond
    };
    if (mimeType) recorderOptions.mimeType = mimeType;
    const recorder = new MediaRecorder(stream, recorderOptions);
    this.mediaRecorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    recorder.onstop = () => {
      this.downloadBlob();
      this.cleanUp();
      this.setState("done");
    };
    recorder.onerror = (e) => {
      const msg = e instanceof ErrorEvent ? e.message : "MediaRecorder error";
      this.cleanUp();
      this.setState("error");
      this.options.onError?.(new Error(msg));
    };
    stream.getTracks().forEach((track) => {
      track.onended = () => {
        if (this._state === "recording") {
          void this.stop();
        }
      };
    });
    recorder.start(250);
    this.setState("recording");
  }
  async stop() {
    if (this._state !== "recording") return;
    this.setState("stopping");
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve();
        return;
      }
      const rec = this.mediaRecorder;
      const orig = rec.onstop;
      rec.onstop = (e) => {
        if (typeof orig === "function") orig.call(rec, e);
        resolve();
      };
      this.mediaRecorder.stop();
    });
  }
  cleanUp() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    if (this.enteredFullscreen) {
      this.enteredFullscreen = false;
      void exitPageFullscreen();
    }
  }
  downloadBlob() {
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
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 2e3);
  }
};
async function requestPageFullscreen() {
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
async function exitPageFullscreen() {
  if (!document.fullscreenElement) return;
  if (typeof document.exitFullscreen !== "function") return;
  try {
    await document.exitFullscreen();
  } catch {
  }
}
function selectMimeType() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}
function dateSuffix() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

// src/core/controller.ts
function defaultSettings(journeys) {
  return {
    journeyId: journeys[0]?.id ?? "",
    speed: DEMO_SPEED_DEFAULT,
    fingerEnabled: true,
    captionsEnabled: true,
    defaultMode: "scan",
    screencastQuality: "standard",
    hideBrowserChrome: true
  };
}
function loadSettings(storageKey, journeys) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultSettings(journeys);
    const parsed = { ...defaultSettings(journeys), ...JSON.parse(raw) };
    parsed.screencastQuality = resolveScreencastQuality(parsed.screencastQuality);
    parsed.hideBrowserChrome = parsed.hideBrowserChrome !== false;
    return parsed;
  } catch {
    return defaultSettings(journeys);
  }
}
function saveSettings(storageKey, s) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(s));
  } catch {
  }
}
function createDemoStudioController(opts) {
  const storageKey = opts.storageKey ?? "demo-studio-settings";
  let state = (() => {
    const loaded = { ...loadSettings(storageKey, opts.journeys), ...opts.defaultSettings ?? {} };
    return {
      open: false,
      settings: loaded,
      refinementText: "",
      runStatus: "idle",
      recorderState: "idle",
      errorMsg: null,
      stepLabel: null,
      autopilotEvent: null,
      fingerVisible: loaded.fingerEnabled,
      captionsEnabled: loaded.captionsEnabled,
      running: false,
      recording: false,
      journeys: opts.journeys
    };
  })();
  const listeners = /* @__PURE__ */ new Set();
  let runRef = null;
  let recorderRef = null;
  function notify() {
    for (const l of listeners) l();
  }
  function setState(patch) {
    state = { ...state, ...patch };
    notify();
  }
  function buildSteps() {
    const journey = findJourneyById(opts.journeys, state.settings.journeyId);
    if (!journey) return null;
    const parsed = state.refinementText.trim().length > 0 ? parseRefinement(journey, state.refinementText) : { steps: journey.steps, speedDelta: 0, speedAbsolute: void 0 };
    const finalSpeed = parsed.speedAbsolute !== void 0 ? parsed.speedAbsolute : Math.min(Math.max(state.settings.speed + parsed.speedDelta, DEMO_SPEED_MIN), DEMO_SPEED_MAX);
    return { steps: parsed.steps, pacing: buildDemoPacing(finalSpeed) };
  }
  function handleAutopilotEvent(event) {
    let stepLabel = state.stepLabel;
    if (event.type === "step-start") {
      const step = event.step;
      if (step.kind === "navigate") stepLabel = step.label ?? step.routeId;
      else if (step.kind === "scroll") stepLabel = `Scrolling (${step.mode})\u2026`;
      else if (step.kind === "caption") stepLabel = step.text.length > 48 ? `${step.text.slice(0, 48)}\u2026` : step.text;
      else if (step.kind === "click") stepLabel = step.label ?? `Click ${step.testId}`;
      else if (step.kind === "seed") stepLabel = `Prepare ${step.target}`;
    }
    let runStatus = state.runStatus;
    let running = state.running;
    if (event.type === "done") {
      runStatus = "done";
      stepLabel = null;
      running = false;
      opts.onRunningChange?.(false);
    }
    if (event.type === "abort") {
      runStatus = "aborted";
      stepLabel = null;
      running = false;
      opts.onRunningChange?.(false);
    }
    setState({ autopilotEvent: event, stepLabel, runStatus, running });
  }
  async function beginDemoRun() {
    const built = buildSteps();
    if (!built || built.steps.length === 0) return null;
    setState({ errorMsg: null, runStatus: "running", running: true, open: false });
    opts.onRunningChange?.(true);
    opts.prepareDemo?.(state.settings.journeyId);
    await new Promise((r) => setTimeout(r, 350));
    return built;
  }
  const actions = {
    setOpen(open) {
      setState({ open });
    },
    toggleOpen() {
      setState({ open: !state.open });
    },
    setSetting(key, value) {
      const settings = { ...state.settings, [key]: value };
      saveSettings(storageKey, settings);
      const patch = { settings };
      if (key === "fingerEnabled") patch.fingerVisible = value;
      if (key === "captionsEnabled") patch.captionsEnabled = value;
      setState(patch);
    },
    setRefinementText(text) {
      setState({ refinementText: text });
    },
    async startRun() {
      const built = await beginDemoRun();
      if (!built) {
        setState({ running: false, runStatus: "idle" });
        opts.onRunningChange?.(false);
        return;
      }
      const run = runAutopilot({
        steps: built.steps,
        pacing: built.pacing,
        navigate: opts.navigate,
        seed: opts.seed,
        onEvent: handleAutopilotEvent,
        mainScrollTestId: opts.mainScrollTestId
      });
      runRef = run;
      await run.done;
    },
    async startScreencast() {
      if (!isScreencastSupported()) {
        setState({ errorMsg: "Screen recording is not available in this browser. Try Chrome or Edge." });
        return;
      }
      const built = await beginDemoRun();
      if (!built) {
        setState({ running: false, runStatus: "idle" });
        opts.onRunningChange?.(false);
        return;
      }
      setState({ runStatus: "recording-start", recording: true });
      const recorder = new ScreencastRecorder({
        filename: `demo-${state.settings.journeyId}`,
        quality: state.settings.screencastQuality,
        hideBrowserChrome: state.settings.hideBrowserChrome,
        onStateChange: (recorderState) => setState({ recorderState }),
        onError: (err) => {
          setState({ errorMsg: err.message, runStatus: "idle", running: false, recording: false });
          opts.onRunningChange?.(false);
        }
      });
      recorderRef = recorder;
      try {
        await recorder.start();
      } catch {
        setState({ running: false, runStatus: "idle", recording: false });
        opts.onRunningChange?.(false);
        return;
      }
      setState({ runStatus: "recording" });
      const run = runAutopilot({
        steps: built.steps,
        pacing: built.pacing,
        navigate: opts.navigate,
        seed: opts.seed,
        onEvent: handleAutopilotEvent,
        mainScrollTestId: opts.mainScrollTestId
      });
      runRef = run;
      await run.done;
      await recorder.stop();
      setState({ recording: false });
    },
    abort() {
      runRef?.abort();
      recorderRef?.stop().catch(() => void 0);
    }
  };
  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions,
    destroy() {
      listeners.clear();
      runRef?.abort();
    }
  };
}

// src/preact/use-demo-studio.ts
function useControllerState(controller) {
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    return controller.subscribe(() => forceUpdate(0));
  }, [controller]);
  return controller.getState();
}
function useDemoStudio(opts) {
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createDemoStudioController(opts);
  }
  const controller = controllerRef.current;
  const state = useControllerState(controller);
  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);
  return { state, actions: controller.actions };
}

// src/preact/demo-studio.tsx
import { useEffect as useEffect3, useReducer as useReducer2, useRef as useRef3 } from "preact/hooks";

// src/preact/demo-finger-overlay.tsx
import { useEffect as useEffect2, useRef as useRef2, useState } from "preact/hooks";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";
var rippleCounter = 0;
function DemoFingerOverlay({ controller }) {
  const { fingerVisible, captionsEnabled, autopilotEvent, running } = useControllerState(controller);
  const visible = running && fingerVisible;
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [caption, setCaption] = useState(null);
  const [ripples, setRipples] = useState([]);
  const captionTimerRef = useRef2(null);
  const lastEventRef = useRef2(null);
  useEffect2(() => {
    const event = autopilotEvent;
    if (!event || event === lastEventRef.current || !visible) return;
    lastEventRef.current = event;
    switch (event.type) {
      case "move":
        setPos({ x: event.x, y: event.y });
        break;
      case "click": {
        setPos({ x: event.x, y: event.y });
        const id = ++rippleCounter;
        setRipples((prev) => [...prev, { id, x: event.x, y: event.y }]);
        setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
        break;
      }
      case "caption":
        if (captionsEnabled) {
          if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
          setCaption(event.text);
          captionTimerRef.current = setTimeout(() => setCaption(null), event.durationMs);
        }
        break;
      case "caption-clear":
        if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        setCaption(null);
        break;
      case "done":
      case "abort":
        setCaption(null);
        setPos({ x: -100, y: -100 });
        break;
    }
  }, [autopilotEvent, visible, captionsEnabled]);
  useEffect2(() => () => {
    if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
  }, []);
  if (!visible) return null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    captionsEnabled && caption && /* @__PURE__ */ jsx("div", { class: "demo-studio-caption-container", children: /* @__PURE__ */ jsx("div", { role: "status", "aria-live": "polite", "data-testid": "kyzmet-demo-caption", class: "demo-studio-caption", children: caption }) }),
    /* @__PURE__ */ jsxs("div", { "data-testid": "kyzmet-demo-finger-overlay", class: "demo-studio-finger-overlay", children: [
      /* @__PURE__ */ jsx("div", { "data-testid": "kyzmet-demo-finger-dot", class: "demo-studio-finger-dot", style: { transform: `translate(${pos.x - 14}px, ${pos.y - 14}px)` } }),
      ripples.map((r) => /* @__PURE__ */ jsx("div", { class: "demo-studio-ripple", style: { left: r.x - 24, top: r.y - 24 } }, r.id))
    ] })
  ] });
}

// src/preact/icons.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "preact/jsx-runtime";
function ClapperboardIcon({ className, style, ...rest }) {
  return /* @__PURE__ */ jsxs2("svg", { viewBox: "0 0 24 24", fill: "none", class: className, style, ...rest, children: [
    /* @__PURE__ */ jsx2("rect", { x: "2", y: "8", width: "20", height: "13", rx: "2", fill: "currentColor", opacity: "0.4" }),
    /* @__PURE__ */ jsx2("rect", { x: "2", y: "5", width: "20", height: "3", rx: "1", fill: "currentColor" }),
    /* @__PURE__ */ jsx2("line", { x1: "7", y1: "5", x2: "5", y2: "3", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" }),
    /* @__PURE__ */ jsx2("line", { x1: "12", y1: "5", x2: "10", y2: "3", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" }),
    /* @__PURE__ */ jsx2("line", { x1: "17", y1: "5", x2: "15", y2: "3", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" }),
    /* @__PURE__ */ jsx2("line", { x1: "22", y1: "5", x2: "20", y2: "3", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" })
  ] });
}
function ClapperboardOpenIcon({ className, style, ...rest }) {
  return /* @__PURE__ */ jsxs2("svg", { viewBox: "0 0 24 24", fill: "none", class: className, style, ...rest, children: [
    /* @__PURE__ */ jsx2("rect", { x: "2", y: "8", width: "20", height: "13", rx: "2", fill: "currentColor", opacity: "0.4" }),
    /* @__PURE__ */ jsx2("path", { d: "M2 5 L22 8 L22 5 L2 2 Z", fill: "currentColor" }),
    /* @__PURE__ */ jsx2("line", { x1: "6.5", y1: "4.5", x2: "5.5", y2: "2.5", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" }),
    /* @__PURE__ */ jsx2("line", { x1: "11.5", y1: "5.5", x2: "10.5", y2: "3.5", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" }),
    /* @__PURE__ */ jsx2("line", { x1: "16.5", y1: "6.5", x2: "15.5", y2: "4.5", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round" })
  ] });
}
function VideocameraIcon({ className, style, ...rest }) {
  return /* @__PURE__ */ jsxs2("svg", { viewBox: "0 0 24 24", fill: "none", class: className, style, ...rest, children: [
    /* @__PURE__ */ jsx2("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2", fill: "currentColor", opacity: "0.4" }),
    /* @__PURE__ */ jsx2("path", { d: "M16 10l5-3v10l-5-3V10z", fill: "currentColor" })
  ] });
}
function CloseIcon({ className, style, ...rest }) {
  return /* @__PURE__ */ jsx2("svg", { viewBox: "0 0 24 24", fill: "none", class: className, style, ...rest, children: /* @__PURE__ */ jsx2("path", { d: "M18 6L6 18M6 6l12 12", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" }) });
}

// src/preact/demo-studio-launcher.tsx
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "preact/jsx-runtime";
function fabClass(mode) {
  switch (mode) {
    case "idle":
      return "demo-studio-fab demo-studio-fab--idle";
    case "open":
      return "demo-studio-fab demo-studio-fab--open";
    case "demo":
      return "demo-studio-fab demo-studio-fab--demo demo-studio-fab--live";
    case "screencast":
      return "demo-studio-fab demo-studio-fab--screencast demo-studio-fab--live";
  }
}
function DemoStudioLauncher({ controller }) {
  const { runStatus, open } = useControllerState(controller);
  const isLive = runStatus === "running" || runStatus === "recording" || runStatus === "recording-start";
  const isScreencast = runStatus === "recording" || runStatus === "recording-start";
  const mode = isScreencast ? "screencast" : isLive ? "demo" : open ? "open" : "idle";
  const ariaLabel = mode === "demo" ? "Stop demo" : mode === "screencast" ? "Stop screencast" : mode === "open" ? "Close Demo Studio" : "Open Demo Studio";
  const testId = isLive ? "kyzmet-demo-studio-abort-launcher" : "kyzmet-demo-studio-launcher";
  function handleClick() {
    if (isLive) controller.actions.abort();
    else controller.actions.toggleOpen();
  }
  return /* @__PURE__ */ jsxs3(
    "button",
    {
      type: "button",
      "data-testid": testId,
      class: fabClass(mode),
      onClick: handleClick,
      "aria-label": ariaLabel,
      title: ariaLabel,
      "data-demo-mode": mode,
      "data-demo-running": isLive ? "true" : void 0,
      "data-demo-recording": isScreencast ? "true" : void 0,
      children: [
        mode === "demo" && /* @__PURE__ */ jsxs3(Fragment2, { children: [
          /* @__PURE__ */ jsx3("span", { class: "demo-studio-launcher-ring demo-studio-launcher-ring--demo", "aria-hidden": true }),
          /* @__PURE__ */ jsx3("span", { class: "demo-studio-launcher-ring demo-studio-launcher-ring--demo demo-studio-launcher-ring--offset", "aria-hidden": true })
        ] }),
        isScreencast && /* @__PURE__ */ jsxs3(Fragment2, { children: [
          /* @__PURE__ */ jsx3("span", { class: "demo-studio-launcher-ring demo-studio-launcher-ring--screencast", "aria-hidden": true }),
          /* @__PURE__ */ jsx3("span", { class: "demo-studio-launcher-ring demo-studio-launcher-ring--screencast demo-studio-launcher-ring--offset", "aria-hidden": true }),
          /* @__PURE__ */ jsx3("span", { class: "demo-studio-record-beacon", "aria-hidden": true })
        ] }),
        /* @__PURE__ */ jsx3(LauncherIcon, { mode })
      ]
    }
  );
}
function LauncherIcon({ mode }) {
  const iconCls = "demo-studio-fab-icon";
  if (mode === "screencast") {
    return /* @__PURE__ */ jsx3(VideocameraIcon, { className: `${iconCls} demo-studio-screencast-icon--live`, "aria-hidden": true });
  }
  if (mode === "demo") {
    return /* @__PURE__ */ jsxs3("span", { style: { position: "relative", display: "grid", width: "1.5rem", height: "1.5rem", placeItems: "center" }, "aria-hidden": true, children: [
      /* @__PURE__ */ jsx3(ClapperboardIcon, { className: `${iconCls} demo-studio-clapper-closed`, style: { position: "absolute", inset: 0 } }),
      /* @__PURE__ */ jsx3(ClapperboardOpenIcon, { className: `${iconCls} demo-studio-clapper-open`, style: { position: "absolute", inset: 0 } })
    ] });
  }
  return /* @__PURE__ */ jsx3(ClapperboardIcon, { className: iconCls, "aria-hidden": true });
}

// src/preact/demo-studio-panel.tsx
import { Fragment as Fragment3, jsx as jsx4, jsxs as jsxs4 } from "preact/jsx-runtime";
function DemoStudioPanel({ controller }) {
  const {
    open,
    settings,
    refinementText,
    runStatus,
    recorderState,
    errorMsg,
    stepLabel,
    running,
    journeys
  } = useControllerState(controller);
  const { actions } = controller;
  const resolvedJourney = journeys.find((j) => j.id === settings.journeyId);
  return /* @__PURE__ */ jsxs4(Fragment3, { children: [
    open && !running && /* @__PURE__ */ jsxs4(
      "div",
      {
        "data-testid": "kyzmet-demo-studio-panel",
        class: "demo-studio-panel demo-studio-panel-shell",
        style: { display: "flex", flexDirection: "column", maxHeight: "min(70vh, calc(100vh - 8rem))", zIndex: 9997 },
        children: [
          /* @__PURE__ */ jsxs4("div", { class: "demo-studio-panel-header", children: [
            /* @__PURE__ */ jsx4("div", { class: "demo-studio-panel-header-icon-badge", "aria-hidden": true, children: /* @__PURE__ */ jsx4(ClapperboardIcon, {}) }),
            /* @__PURE__ */ jsxs4("div", { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ jsx4("p", { class: "demo-studio-panel-header-title", children: "Demo Studio" }),
              /* @__PURE__ */ jsx4("p", { class: "demo-studio-panel-header-subtitle", children: "Create screencasts" })
            ] }),
            /* @__PURE__ */ jsx4("div", { class: "demo-studio-panel-header-actions", children: /* @__PURE__ */ jsx4("button", { type: "button", class: "demo-studio-panel-header-close", "aria-label": "Close Demo Studio", onClick: () => actions.setOpen(false), children: /* @__PURE__ */ jsx4(CloseIcon, {}) }) })
          ] }),
          /* @__PURE__ */ jsxs4("div", { class: "demo-studio-panel-body", children: [
            /* @__PURE__ */ jsxs4("div", { class: "demo-studio-field-group", children: [
              /* @__PURE__ */ jsx4("label", { htmlFor: "demo-studio-journey", class: "demo-studio-field-label", children: "Journey" }),
              /* @__PURE__ */ jsx4(
                "select",
                {
                  id: "demo-studio-journey",
                  class: "demo-studio-select",
                  value: settings.journeyId,
                  onChange: (e) => actions.setSetting("journeyId", e.target.value),
                  "data-testid": "kyzmet-demo-studio-journey-picker",
                  children: journeys.map((j) => /* @__PURE__ */ jsx4("option", { value: j.id, children: j.label }, j.id))
                }
              )
            ] }),
            /* @__PURE__ */ jsxs4("div", { class: "demo-studio-field-group", children: [
              /* @__PURE__ */ jsxs4("label", { htmlFor: "demo-studio-speed", class: "demo-studio-field-label", children: [
                "Speed ",
                settings.speed.toFixed(1),
                "\xD7"
              ] }),
              /* @__PURE__ */ jsx4(
                "input",
                {
                  id: "demo-studio-speed",
                  type: "range",
                  min: DEMO_SPEED_MIN,
                  max: DEMO_SPEED_MAX,
                  step: 0.1,
                  value: settings.speed,
                  onInput: (e) => actions.setSetting("speed", parseFloat(e.target.value)),
                  "data-testid": "kyzmet-demo-studio-speed-slider",
                  class: "demo-studio-speed-slider"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs4("div", { class: "demo-studio-field-group", children: [
              /* @__PURE__ */ jsx4("label", { htmlFor: "demo-studio-refine", class: "demo-studio-field-label", children: "Refine (optional)" }),
              /* @__PURE__ */ jsx4(
                "textarea",
                {
                  id: "demo-studio-refine",
                  class: "demo-studio-textarea",
                  value: refinementText,
                  onInput: (e) => actions.setRefinementText(e.target.value),
                  placeholder: "faster \xB7 skip welcome \xB7 linger on share review",
                  rows: 2,
                  "data-testid": "kyzmet-demo-studio-refine-textarea"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs4("div", { class: "demo-studio-field-group", children: [
              /* @__PURE__ */ jsx4("label", { for: "demo-studio-quality", class: "demo-studio-field-label", children: "Screencast quality" }),
              /* @__PURE__ */ jsx4(
                "select",
                {
                  id: "demo-studio-quality",
                  class: "demo-studio-select",
                  value: settings.screencastQuality,
                  onChange: (e) => actions.setSetting("screencastQuality", e.target.value),
                  "data-testid": "kyzmet-demo-studio-quality",
                  children: SCREENCAST_QUALITIES.map((quality) => /* @__PURE__ */ jsx4("option", { value: quality, children: SCREENCAST_QUALITY_PRESETS[quality].label }, quality))
                }
              )
            ] }),
            /* @__PURE__ */ jsxs4("div", { class: "demo-studio-settings-inset", children: [
              /* @__PURE__ */ jsx4(ToggleRow, { id: "demo-studio-finger", label: "Finger overlay", description: "Show the guided tap dot during the demo.", checked: settings.fingerEnabled, onChange: (v) => actions.setSetting("fingerEnabled", v), testId: "kyzmet-demo-studio-finger-toggle" }),
              /* @__PURE__ */ jsx4(ToggleRow, { id: "demo-studio-captions", label: "Captions", description: "Show narration pills during caption steps.", checked: settings.captionsEnabled, onChange: (v) => actions.setSetting("captionsEnabled", v), testId: "kyzmet-demo-studio-captions-toggle" }),
              /* @__PURE__ */ jsx4(ToggleRow, { id: "demo-studio-default-mode", label: "Read scroll mode", description: "On: linger and read each page. Off: skim-scan pace.", checked: settings.defaultMode === "read", onChange: (readMode) => actions.setSetting("defaultMode", readMode ? "read" : "scan"), testId: "kyzmet-demo-studio-default-mode" }),
              /* @__PURE__ */ jsx4(ToggleRow, { id: "demo-studio-hide-chrome", label: "Page contents only", description: "Hide bookmark, URL, and tab bars. Choose this tab in the browser share picker.", checked: settings.hideBrowserChrome, onChange: (v) => actions.setSetting("hideBrowserChrome", v), testId: "kyzmet-demo-studio-hide-chrome" })
            ] }),
            stepLabel && /* @__PURE__ */ jsxs4("p", { class: "demo-studio-status", children: [
              "\u2192 ",
              stepLabel
            ] }),
            errorMsg && /* @__PURE__ */ jsx4("p", { class: "demo-studio-status demo-studio-status--error", children: errorMsg }),
            runStatus === "done" && /* @__PURE__ */ jsx4("p", { class: "demo-studio-status demo-studio-status--success", children: "\u2713 Demo complete" }),
            recorderState === "done" && runStatus === "done" && /* @__PURE__ */ jsx4("p", { class: "demo-studio-status demo-studio-status--success", children: "\u2713 Screencast downloaded" }),
            /* @__PURE__ */ jsxs4("div", { class: "demo-studio-actions", children: [
              /* @__PURE__ */ jsx4("button", { type: "button", class: "demo-studio-btn demo-studio-btn--primary", onClick: () => void actions.startRun(), disabled: !resolvedJourney, "data-testid": "kyzmet-demo-studio-run", children: "Run demo" }),
              /* @__PURE__ */ jsx4("button", { type: "button", class: "demo-studio-btn demo-studio-btn--secondary", onClick: () => void actions.startScreencast(), disabled: !resolvedJourney || !isScreencastSupported(), "data-testid": "kyzmet-demo-studio-screencast", children: "Screencast" })
            ] })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx4(DemoStudioLauncher, { controller })
  ] });
}
function ToggleRow({ id, label, description, checked, onChange, testId }) {
  return /* @__PURE__ */ jsxs4("div", { class: "demo-studio-toggle-row", children: [
    /* @__PURE__ */ jsxs4("div", { class: "demo-studio-toggle-text", children: [
      /* @__PURE__ */ jsx4("label", { htmlFor: id, class: "demo-studio-toggle-label", children: label }),
      /* @__PURE__ */ jsx4("p", { class: "demo-studio-toggle-description", children: description })
    ] }),
    /* @__PURE__ */ jsx4(
      "button",
      {
        type: "button",
        role: "switch",
        id,
        class: "demo-studio-toggle",
        "aria-checked": checked ? "true" : "false",
        onClick: () => onChange(!checked),
        "data-testid": testId,
        children: /* @__PURE__ */ jsx4("span", { class: "demo-studio-toggle-knob" })
      }
    )
  ] });
}

// src/preact/demo-studio.tsx
import { jsx as jsx5, jsxs as jsxs5 } from "preact/jsx-runtime";
function DemoStudio({ className, style, ...opts }) {
  const controllerRef = useRef3(null);
  if (!controllerRef.current) {
    controllerRef.current = createDemoStudioController(opts);
  }
  const controller = controllerRef.current;
  const [, forceUpdate] = useReducer2((n) => n + 1, 0);
  useEffect3(() => {
    const unsubscribe = controller.subscribe(() => forceUpdate(0));
    return () => {
      unsubscribe();
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [controller]);
  return /* @__PURE__ */ jsxs5("div", { class: className, style, children: [
    /* @__PURE__ */ jsx5(DemoFingerOverlay, { controller }),
    /* @__PURE__ */ jsx5(DemoStudioPanel, { controller })
  ] });
}
export {
  DemoFingerOverlay,
  DemoStudio,
  DemoStudioLauncher,
  DemoStudioPanel,
  useControllerState,
  useDemoStudio
};
