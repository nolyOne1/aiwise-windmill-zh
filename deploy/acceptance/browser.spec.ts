import { expect, test } from "../../frontend/node_modules/@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;

  const reportPath = testInfo.outputPath("failure-summary.txt");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    [
      `status=${testInfo.status}`,
      `expected_status=${testInfo.expectedStatus}`,
      `path=${new URL(page.url()).pathname}`,
    ].join("\n"),
  );
  if (page.isClosed()) return;

  const masks = [];
  for (const locator of [
    page.locator("#email"),
    page.locator("#password"),
    page.getByText(/欢迎使用！已为你预填默认凭据|Welcome! Default credentials/),
  ]) {
    if ((await locator.count()) > 0) masks.push(locator.first());
  }
  await page.screenshot({
    path: testInfo.outputPath("failure.png"),
    fullPage: true,
    mask: masks,
  });
});

async function expectNavigation(
  page,
  labels: {
    scripts: string;
    flows: string;
    schedules: string;
    runs: string;
    settings: string;
  },
) {
  await expect(
    page.getByText(labels.scripts, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(labels.flows, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(labels.schedules, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(labels.runs, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(labels.settings, { exact: true }).first(),
  ).toBeVisible();
}

async function closeUserSettings(page) {
  const overlay = page.locator(".windmill-drawer.open .overlay");
  await expect(overlay).toBeVisible();
  await overlay.click({ position: { x: 5, y: 5 } });
  await expect(overlay).toBeHidden();
}

test("authenticated Chinese UI can switch languages and retain synthetic paths", async ({
  page,
}) => {
  await page.goto("/user/login");
  await expect(page.locator('input#email[type="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();

  await page.locator('input#email[type="email"]').fill("admin@windmill.dev");
  await page.locator('input#password[type="password"]').fill("changeme");
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/user\/(first-time|workspaces)/);
  if (page.url().includes("/user/first-time")) {
    await page.getByRole("button", { name: "Skip" }).click();
  }
  await page.waitForURL("**/user/workspaces");
  await page.getByText("Admins", { exact: true }).click();
  await page.waitForURL("**/");

  await expectNavigation(page, {
    scripts: "脚本",
    flows: "流程",
    schedules: "定时任务",
    runs: "运行记录",
    settings: "设置",
  });

  await page.getByRole("button", { name: /User \(admin\)/i }).click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  await expect(page.getByText("语言", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "English" }).click();
  await expectNavigation(page, {
    scripts: "Scripts",
    flows: "Flows",
    schedules: "Schedules",
    runs: "Runs",
    settings: "Settings",
  });
  await page.reload();
  await expectNavigation(page, {
    scripts: "Scripts",
    flows: "Flows",
    schedules: "Schedules",
    runs: "Runs",
    settings: "Settings",
  });
  await closeUserSettings(page);

  await page.getByRole("button", { name: /User \(admin\)/i }).click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  await page.getByRole("radio", { name: "简体中文" }).click();
  await page.reload();
  await expectNavigation(page, {
    scripts: "脚本",
    flows: "流程",
    schedules: "定时任务",
    runs: "运行记录",
    settings: "设置",
  });
  await closeUserSettings(page);

  await page.goto("/scripts/get/u/admin/acceptance_inventory");
  await expect(page.locator("body")).toContainText(
    "u/admin/acceptance_inventory",
  );
  await expect(page.locator("#run-form-run-button")).toBeVisible();
  await page.goto("/schedules");
  await expect(page.getByRole("heading", { name: "定时任务" })).toBeVisible();
  await page.goto("/runs/");
  await expect(page.getByRole("heading", { name: "运行记录" })).toBeVisible();
});
