import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: Page, admin = false) {
  await page.goto("/");
  await page
    .getByLabel("Institution email")
    .fill(admin ? "admin@example.invalid" : "student@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("CampusTest123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
}
async function nav(page: Page, name: string) {
  const opener = page.getByRole("button", { name: "Open navigation" });
  if (await opener.isVisible()) await opener.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}

test("home, next class, contextual follow-up and cited source", async ({
  page,
}, info) => {
  await signIn(page);
  await expect(
    page.getByPlaceholder("Ask anything about your campus..."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Admin Console", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".next-panel")).toBeVisible();
  await page.screenshot({
    path: `../artifacts/screenshots/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "My next class", exact: true })
    .click();
  await expect(page.locator(".chat-answer").first()).toBeVisible();
  await expect(page.locator(".citations button").first()).toBeVisible();
  await page
    .getByLabel("Ask a campus question")
    .fill("Where is that professor’s office?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".chat-message").last()).toContainText("Block A");
});
test("vegetarian budget and meal calculations", async ({ page }) => {
  await signIn(page);
  await nav(page, "Canteen");
  await page.getByLabel("Maximum budget").fill("100");
  await page.getByLabel("Dietary preference").selectOption("true");
  await expect(page.locator(".food-grid .record-card").first()).toBeVisible();
  await expect(page.locator(".nonveg")).toHaveCount(0);
  const prices = await page.locator(".food-grid .price").allTextContents();
  expect(prices.every((p) => Number(p.replace("₹", "")) <= 100)).toBeTruthy();
  await page
    .getByRole("button", { name: "Meal combinations", exact: true })
    .click();
  await expect(
    page.getByText(/estimated protein · Vegetarian/).first(),
  ).toBeVisible();
});
test("navigation, missing information and narrow screen layout", async ({
  page,
}) => {
  await signIn(page);
  await nav(page, "Timetable");
  await page.getByLabel("Date", { exact: true }).fill("2030-01-01");
  await expect(page.getByText("No records yet.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await nav(page, "Notices");
  await expect(
    page.getByRole("heading", { name: "Notices", exact: true }),
  ).toBeVisible();
});
test("administrator uploads and student-ready import confirmation", async ({
  page,
}) => {
  await signIn(page, true);
  await nav(page, "Admin Console");
  await page.getByLabel("What are you importing?").selectOption("menu");
  await page
    .getByLabel("Source file")
    .setInputFiles({
      name: `qa-menu-${Date.now()}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(
        `name,price,vegetarian,category,location\nQA dal ${Date.now()},55,true,Meal,QA Canteen\n`,
      ),
    });
  await page.getByRole("button", { name: "Preview file" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your import" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(
    page.getByText(/records imported. Student queries can use them now./),
  ).toBeVisible({ timeout: 30000 });
});
test("upload validation provides recovery", async ({ page }) => {
  await signIn(page, true);
  await nav(page, "Admin Console");
  await page.getByLabel("What are you importing?").selectOption("menu");
  await page
    .getByLabel("Source file")
    .setInputFiles({
      name: "invalid-menu.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "name,price,vegetarian,category,location\nInvalid,-5,true,Meal,QA\n",
      ),
    });
  await page.getByRole("button", { name: "Preview file" }).click();
  await expect(page.getByText(/record\(s\) need attention/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Confirm import/ }),
  ).toBeDisabled();
});
test("accessibility and API failure recovery", async ({ page }) => {
  await signIn(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.route("**/v1/menu?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Menu temporarily unavailable. Try again.",
      }),
    }),
  );
  await nav(page, "Canteen");
  await expect(
    page.getByRole("alert").filter({ hasText: "Menu temporarily unavailable" }),
  ).toContainText("Menu temporarily unavailable");
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeVisible();
});
