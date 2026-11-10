import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";

test("assessment guide explains scope and downloads a real source package", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Abhay" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Assessment guide", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "A focused product. A clear handoff.",
    }),
  ).toBeVisible();
  await expect(dialog).toContainText("Abhay Chouhan");
  await expect(dialog.locator(".capability-list li")).toHaveCount(5);
  await expect(dialog).toContainText("No live cursors");
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/assessment-guide.png",
    animations: "disabled",
  });

  const packageEvent = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download source & docs", exact: true })
    .click();
  const archive = await packageEvent;
  expect(archive.suggestedFilename()).toBe("CollabDocs-submission.zip");
  const archivePath = await archive.path();
  expect(archivePath).toBeTruthy();
  expect(readFileSync(archivePath!).subarray(0, 2).toString()).toBe("PK");
  expect(readFileSync(archivePath!).byteLength).toBeGreaterThan(10000);

  const submissionEvent = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "SUBMISSION.md", exact: true })
    .click();
  const submission = await submissionEvent;
  const markdown = readFileSync((await submission.path())!, "utf8");
  expect(markdown.split("\n").length).toBeLessThanOrEqual(1000);
  expect(markdown).toContain("Abhay Chouhan");
  expect(markdown).toContain("abhaydinakar246@gmail.com");

  await dialog.locator("summary").click();
  await expect(dialog.locator(".walkthrough-content")).toContainText(
    "No video has been recorded",
  );
  const scriptEvent = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download recording script", exact: true })
    .click();
  expect((await scriptEvent).suggestedFilename()).toBe("WALKTHROUGH_SCRIPT.md");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Assessment guide", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Try the editor", exact: true })
    .click();
  await expect(page).toHaveURL(/\/documents\//);
  const id = page.url().split("/").pop()!;
  try {
    await expect(page.locator(".collab-editor")).toBeVisible();
  } finally {
    await page.request.delete(`/api/documents/${id}`);
    await page.request.delete(`/api/documents/${id}?permanent=true`);
  }
});

test("mobile assessment guide is keyboard dismissible and launches real import", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Abhay" }),
  ).toBeVisible();
  const trigger = page.getByRole("button", {
    name: "Open assessment and submission guide",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog
    .getByRole("button", { name: "Import a file", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Bring your words along" }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Ajaia reviewer note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Reviewer note\n\nA **working** import.\n\n- One\n- Two",
    ),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import document", exact: true })
    .click();
  await expect(page).toHaveURL(/\/documents\//);
  const id = page.url().split("/").pop()!;
  try {
    await expect(page.locator(".collab-editor h1")).toHaveText("Reviewer note");
    await expect(page.locator(".collab-editor strong")).toHaveText("working");
  } finally {
    await page.request.delete(`/api/documents/${id}`);
    await page.request.delete(`/api/documents/${id}?permanent=true`);
  }
});
