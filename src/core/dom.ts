/**
 * DOM helpers — self-contained, no external dependencies.
 * Replaces @kyzmet/os-shell scrollMainScrollContainerToTestId.
 */

export interface WaitForTestIdOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export function queryTestId(testId: string): HTMLElement | null {
  return document.querySelector(
    `[data-testid="${testId}"]`,
  ) as HTMLElement | null;
}

export function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return true;
  // Accept connected controls before first layout pass (autopilot polls quickly).
  return el.matches("button, a, input, select, textarea, [role='button']");
}

/** Poll until a test id is present and visible, or timeout. */
export async function waitForTestId(
  testId: string,
  options: WaitForTestIdOptions = {},
): Promise<HTMLElement | null> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const el = queryTestId(testId);
    if (el && isElementVisible(el)) return el;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const last = queryTestId(testId);
  return last && isElementVisible(last) ? last : null;
}

export function scrollContainerToTestId(
  testId: string,
  behavior: ScrollBehavior = "smooth",
): void {
  const el = document.querySelector(
    `[data-testid="${testId}"]`,
  ) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior, block: "nearest" });
}
