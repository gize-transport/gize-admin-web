import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** engineering-standards.md: zero serious or critical axe violations on every page. */
export async function expectNoSeriousA11yViolations(page: Page) {
  // A client navigation (after sign-in, a link) sets the title from streamed metadata, which can
  // arrive just after the content: wait for it, so axe judges the finished page. A page with no
  // title still fails here.
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations
    .filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    )
    .map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target),
    }));
  expect(blocking).toEqual([]);
}
