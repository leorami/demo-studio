import { afterEach, describe, expect, it } from "vitest";
import { isElementVisible, queryTestId, waitForTestId } from "./dom.js";

function mount(testId: string, tag = "button"): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute("data-testid", testId);
  el.textContent = testId;
  document.body.appendChild(el);
  return el;
}

describe("waitForTestId", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("returns a connected control immediately", async () => {
    const button = mount("ready-btn");
    await expect(waitForTestId("ready-btn", { timeoutMs: 50 })).resolves.toBe(button);
  });

  it("polls until a delayed test id appears", async () => {
    const found = waitForTestId("late-btn", { timeoutMs: 400, intervalMs: 20 });
    setTimeout(() => mount("late-btn"), 60);
    await expect(found).resolves.toMatchObject({ dataset: { testid: "late-btn" } });
  });

  it("returns null when the test id never appears", async () => {
    await expect(waitForTestId("missing", { timeoutMs: 60, intervalMs: 20 })).resolves.toBeNull();
  });

  it("stops polling when aborted", async () => {
    const controller = new AbortController();
    const pending = waitForTestId("never", {
      timeoutMs: 1_000,
      intervalMs: 20,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 30);
    await expect(pending).resolves.toBeNull();
  });

  it("treats display:none and aria-hidden nodes as not visible", () => {
    const hidden = mount("hidden-btn");
    hidden.style.display = "none";
    expect(isElementVisible(hidden)).toBe(false);

    const ariaHidden = mount("aria-btn");
    ariaHidden.setAttribute("aria-hidden", "true");
    expect(isElementVisible(ariaHidden)).toBe(false);

    expect(queryTestId("hidden-btn")).toBe(hidden);
  });
});
