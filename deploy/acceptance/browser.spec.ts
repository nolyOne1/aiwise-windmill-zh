import { expect, test } from "../../frontend/node_modules/@playwright/test";
import { mkdir } from "node:fs/promises";

const screenshotDir = "deploy/acceptance/results/screenshots";

test("authenticated Chinese UI can switch languages and retain synthetic paths", async ({
  page,
}) => {
  await mkdir(screenshotDir, { recursive: true });
  await page.goto("/user/login");
  await expect(page.locator('input#email[type="email"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /登录|Sign in/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/01-login-zh.png`,
    fullPage: true,
  });

  await page.locator('input#email[type="email"]').fill("admin@windmill.dev");
  await page.locator('input#password[type="password"]').fill("changeme");
  await page.getByRole("button", { name: /登录|Sign in/ }).click();
  await page.waitForURL(/\/user\/(first-time|workspaces)/);
  if (page.url().includes("/user/first-time")) {
    await page.getByRole("button", { name: /跳过|Skip/ }).click();
  }
  await page.waitForURL("**/user/workspaces");
  await page.getByText("Admins", { exact: true }).click();
  await page.waitForURL("**/");

  await expect(page.getByText(/脚本|Scripts/).first()).toBeVisible();
  await expect(page.getByText(/流程|Flows/).first()).toBeVisible();
  await expect(page.getByText(/定时|Schedules/).first()).toBeVisible();
  await expect(page.getByText(/运行|Runs/).first()).toBeVisible();
  await expect(page.getByText(/设置|Settings/).first()).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/02-admins-zh.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: /User \(admin\)/i }).click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  await expect(page.getByText(/语言|Language/)).toBeVisible();
  await page.getByRole("tab", { name: "English" }).click();
  await expect(page.getByText("Scripts").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Scripts").first()).toBeVisible();
  await page.screenshot({
    path: `${screenshotDir}/03-admins-en.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: /User \(admin\)/i }).click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  await page.getByRole("tab", { name: "简体中文" }).click();
  await page.reload();
  await expect(page.getByText(/脚本/).first()).toBeVisible();

  for (const route of ["/scripts", "/schedules", "/runs"]) {
    await page.goto(route);
    await expect(page.locator("body")).toContainText(/./);
  }
  await page.goto("/scripts/get/u/admin/acceptance_inventory");
  await expect(page.locator("body")).toContainText(
    "u/admin/acceptance_inventory",
  );
  await page.screenshot({
    path: `${screenshotDir}/04-synthetic-script.png`,
    fullPage: true,
  });
});
