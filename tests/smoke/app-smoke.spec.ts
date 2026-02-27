import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL ?? "";
const password = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("app smoke", () => {
  test.beforeEach(async ({ request, page }) => {
    test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD.");

    const response = await request.post("/api/test/login", {
      data: { email, password },
    });

    expect(response.ok()).toBeTruthy();
    await page.goto("/dashboard");
  });

  test("auth login loads dashboard", async ({ page }) => {
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("company settings loads without schema-cache rpc error", async ({ page }) => {
    await page.goto("/settings/company");
    await expect(page.getByText("Company Settings")).toBeVisible();
    await expect(page.getByText("Could not find the function public.my_company_id")).toHaveCount(0);
  });

  test("schedule page renders week grid", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.getByText("Schedule")).toBeVisible();
    await expect(page.locator("[data-testid^='week-day-']").first()).toBeVisible();
  });

  test("manager jobs page renders", async ({ page }) => {
    await page.goto("/manager/jobs");
    await expect(page.getByText("Jobs")).toBeVisible();
  });

  test("worker jobs page renders", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByText("Find Jobs")).toBeVisible();
  });

  test("notifications page renders", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByText("Notifications")).toBeVisible();
  });

  test("topbar bell dropdown opens", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Open notifications page")).toBeVisible();
  });

  test("manager job detail applicants tab renders when a job exists", async ({ page }) => {
    await page.goto("/manager/jobs");
    await expect(page.getByText("Jobs")).toBeVisible();
    const openButtons = page.getByRole("link", { name: "Open" });
    const count = await openButtons.count();
    test.skip(count === 0, "No manager jobs available to open detail page.");
    await openButtons.first().click();
    await expect(page.getByRole("button", { name: "Applicants" })).toBeVisible();
  });
});
