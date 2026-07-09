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

// src/core/dom.ts
function scrollContainerToTestId(testId, behavior = "smooth") {
  const el = document.querySelector(
    `[data-testid="${testId}"]`
  );
  if (!el) return;
  el.scrollIntoView({ behavior, block: "nearest" });
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
  const primaryTestId = containerTestId ?? mainScrollTestId;
  if (primaryTestId) {
    const primary = tryContainer(
      document.querySelector(`[data-testid="${primaryTestId}"]`)
    );
    if (primary) return primary;
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
function readingFingerPosition() {
  return {
    x: Math.round(window.innerWidth * 0.55),
    y: Math.round(window.innerHeight * 0.62)
  };
}
function runAutopilot(opts) {
  const pacing = opts.pacing ?? buildDemoPacing(1.5);
  const navigateSettleMs = opts.navigateSettleMs ?? 900;
  const visitCounts = /* @__PURE__ */ new Map();
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
        break;
      }
      case "scroll": {
        await runScroll(step.mode, step.containerTestId);
        break;
      }
      case "click": {
        const el = document.querySelector(`[data-testid="${step.testId}"]`);
        if (el) {
          scrollContainerToTestId(step.testId, "instant");
          await sleep(160 + jitter(80));
          const { x, y } = centreOf(el);
          emit({ type: "move", x, y });
          await sleep(220 + jitter(120));
          emit({ type: "click", x, y, testId: step.testId });
          el.click();
          await sleep(navigateSettleMs);
        }
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
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // @ts-expect-error — Chrome-specific hint
        preferCurrentTab: true
      });
    } catch (err) {
      this.setState("idle");
      const error = err instanceof Error ? err : new Error("Screen share cancelled or denied.");
      this.options.onError?.(error);
      throw error;
    }
    this.stream = stream;
    const mimeType = selectMimeType();
    const recorderOptions = {
      videoBitsPerSecond: this.options.videoBitsPerSecond ?? 25e5
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
    defaultMode: "scan"
  };
}
function loadSettings(storageKey, journeys) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultSettings(journeys);
    return { ...defaultSettings(journeys), ...JSON.parse(raw) };
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

// src/test-utils/manifest-parity.ts
function collectDuplicateIds(entries) {
  const seen = /* @__PURE__ */ new Set();
  const duplicates = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id);
      continue;
    }
    seen.add(entry.id);
  }
  return [...duplicates].sort();
}
function assertManifestMatchesJourneys(journeys, manifest) {
  const duplicateIds = collectDuplicateIds(manifest);
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate manifest IDs: ${duplicateIds.join(", ")}`
    );
  }
  const journeyIds = new Set(journeys.map((journey) => journey.id));
  const manifestIds = new Set(manifest.map((entry) => entry.id));
  const missingManifestEntries = [...journeyIds].filter((id) => !manifestIds.has(id)).sort();
  if (missingManifestEntries.length > 0) {
    throw new Error(
      `Missing manifest entries for journey IDs: ${missingManifestEntries.join(", ")}`
    );
  }
  const extraManifestEntries = [...manifestIds].filter((id) => !journeyIds.has(id)).sort();
  if (extraManifestEntries.length > 0) {
    throw new Error(
      `Extra manifest entries with no matching journey: ${extraManifestEntries.join(", ")}`
    );
  }
}

// src/test-utils/doc-hygiene.ts
var DEFAULT_BANNED_PATTERNS = [
  { label: "api-key-assignment", regex: /\b(?:api[_-]?key|secret|token)\s*=\s*\S+/i },
  { label: "openai-sk-token", regex: /\bsk-(?:proj-)?[A-Za-z0-9]{8,}\b/ },
  { label: "github-pat", regex: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { label: "env-file-reference", regex: /\.env(?:\.[A-Za-z0-9_-]+)?\b/i },
  { label: "private-artifact-path", regex: /\.(?:sealed|pem|key|p12)\b/i },
  { label: "custody-artifact-path", regex: /custody\/|\.custodian\./i },
  { label: "email-address", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { label: "invite-token", regex: /\binvite[_-]?token\s*=\s*\S+/i }
];
function lineMatchesPattern(line, pattern) {
  pattern.lastIndex = 0;
  return pattern.test(line);
}
function isLineAllowed(line, allowedPatterns) {
  if (!allowedPatterns || allowedPatterns.length === 0) {
    return false;
  }
  return allowedPatterns.some((pattern) => lineMatchesPattern(line, pattern));
}
function collectPatterns(options) {
  const patterns = [...DEFAULT_BANNED_PATTERNS];
  for (const regex of options?.additionalPatterns ?? []) {
    patterns.push({
      label: regex.source,
      regex
    });
  }
  return patterns;
}
function scanDocForBannedContent(content, options) {
  const patterns = collectPatterns(options);
  const violations = [];
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (isLineAllowed(line, options?.allowedPatterns)) {
      continue;
    }
    for (const pattern of patterns) {
      if (!lineMatchesPattern(line, pattern.regex)) {
        continue;
      }
      violations.push({
        pattern: pattern.label,
        line: index + 1,
        excerpt: line.trim().slice(0, 160)
      });
      break;
    }
  }
  return violations;
}
export {
  DEFAULT_DEMO_PACING,
  DEMO_SPEED_DEFAULT,
  DEMO_SPEED_MAX,
  DEMO_SPEED_MIN,
  ScreencastRecorder,
  assertManifestMatchesJourneys,
  buildDemoPacing,
  createDemoStudioController,
  familiarityFactor,
  findJourneyById,
  isScreencastSupported,
  jitter,
  parseRefinement,
  readingTimeMs,
  runAutopilot,
  scanDocForBannedContent,
  scrollContainerToTestId
};
