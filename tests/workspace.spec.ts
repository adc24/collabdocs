import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("desktop workspace, formatting, autosave, sharing, and account switching", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Abhay" }),
  ).toBeVisible();
  await expect(page.locator(".profile-button strong")).toHaveText(
    "Abhay Chouhan",
  );
  await expect(page.locator(".document-card").first()).toBeVisible();
  expect(await page.locator(".document-card").count()).toBeGreaterThanOrEqual(
    6,
  );
  await expect(
    page.getByRole("button", { name: "Open Website redesign", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Grid view", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search documents", exact: true })
    .fill("Website redesign");
  await expect(page.locator(".document-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Website redesign", exact: true })
    .click();
  await expect(page.locator(".collab-editor")).toBeVisible();
  await expect(page.locator(".collab-editor")).toContainText(
    "A fresh perspective.",
  );
  await page.screenshot({
    path: "artifacts/editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Back to workspace", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New document", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/documents\//);
  await expect(page.locator(".collab-editor")).toBeVisible();
  const id = page.url().split("/").pop()!;
  try {
    const title = `Browser-tested idea ${Date.now()}`;
    await page
      .getByRole("textbox", { name: "Document title", exact: true })
      .fill(title);
    await page
      .locator(".collab-editor")
      .fill("A persistent idea, beautifully formatted.");
    await page.locator(".collab-editor").press("ControlOrMeta+a");
    await page
      .getByRole("button", { name: "Bold (Ctrl/⌘ + B)", exact: true })
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".save-status")).toHaveText("All changes saved");
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Document title", exact: true }),
    ).toHaveValue(title);
    await expect(page.locator(".collab-editor strong")).toContainText(
      "A persistent idea",
    );
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Invite by email", exact: true })
      .fill("reviewer@example.com");
    await page
      .getByRole("button", { name: "Send invitation", exact: true })
      .click();
    await expect(page.locator(".collaborator-list")).toContainText(
      "Alex Morgan",
    );
    await page.screenshot({ path: "artifacts/share-dialog.png" });
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page
      .getByRole("button", { name: "Back to workspace", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Switch account", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Alex Morgan.*reviewer@example.com/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Welcome back, Alex" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `Open ${title}`, exact: true })
      .click();
    await expect(page.locator(".collab-editor strong")).toContainText(
      "A persistent idea",
    );
    await expect(page.locator(".collab-editor")).toHaveAttribute(
      "contenteditable",
      "true",
    );
    expect(errors).toEqual([]);
  } finally {
    await page.request.post("/api/auth/login", {
      data: { email: "abhay@example.com", password: "demo123" },
    });
    await page.request.delete(`/api/documents/${id}`);
    await page.request.delete(`/api/documents/${id}?permanent=true`);
  }
});

test("mobile navigation and Markdown import work without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Abhay" }),
  ).toBeVisible();
  await expect(page.locator(".document-card").first()).toBeVisible();
  expect(await page.locator(".document-card").count()).toBeGreaterThanOrEqual(
    6,
  );
  await expect(
    page.getByRole("button", { name: "Open Website redesign", exact: true }),
  ).toBeVisible();
  mkdirSync("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Starred/ }).click();
  await expect(
    page.getByRole("heading", { name: "Starred", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import document", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "Mobile test.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# A little mobile idea\n\nThis is **bold**.\n\n- One\n- Two",
    ),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import document", exact: true })
    .click();
  await expect(page).toHaveURL(/\/documents\//);
  const id = page.url().split("/").pop()!;
  try {
    await expect(page.locator(".collab-editor h1")).toHaveText(
      "A little mobile idea",
    );
    await expect(page.locator(".collab-editor strong")).toHaveText("bold");
    await expect(page.locator(".collab-editor li")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "artifacts/editor-mobile.png",
      fullPage: true,
    });
  } finally {
    await page.request.delete(`/api/documents/${id}`);
    await page.request.delete(`/api/documents/${id}?permanent=true`);
  }
});
