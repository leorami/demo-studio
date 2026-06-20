/**
 * DOM helpers — self-contained, no external dependencies.
 * Replaces @kyzmet/os-shell scrollMainScrollContainerToTestId.
 */

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
