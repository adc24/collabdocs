import { test, expect } from "@playwright/test";

test("serialized autosave keeps the latest edit and conflicts never overwrite a collaborator", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Abhay" }),
  ).toBeVisible();
  const response = await page.request.post("/api/documents", {
    data: { title: "Autosave reliability test" },
  });
  expect(response.status()).toBe(201);
  const initial = (await response.json()).document;
  const id = initial.id;
  try {
    await page.goto(`/documents/${id}`);
    await expect(page.locator(".collab-editor")).toBeVisible();
    let firstSaveStarted = false;
    await page.route(`**/api/documents/${id}`, async (route) => {
      if (route.request().method() === "PUT" && !firstSaveStarted) {
        firstSaveStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.continue();
    });
    await page.locator(".collab-editor").fill("The first thought.");
    await expect.poll(() => firstSaveStarted).toBe(true);
    await page
      .locator(".collab-editor")
      .fill("The latest thought must be the one that survives.");
    await expect(page.locator(".save-status")).toHaveText("All changes saved");
    const saved = (
      await (await page.request.get(`/api/documents/${id}`)).json()
    ).document;
    expect(JSON.stringify(saved.content)).toContain(
      "The latest thought must be the one that survives.",
    );
    expect(saved.revision).toBeGreaterThanOrEqual(3);

    const remoteContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The collaborator’s newer version." },
          ],
        },
      ],
    };
    const remote = await page.request.put(`/api/documents/${id}`, {
      data: { content: remoteContent, revision: saved.revision },
    });
    expect(remote.status()).toBe(200);
    await page
      .locator(".collab-editor")
      .fill("A stale local draft that must not overwrite the remote version.");
    await expect(page.locator(".save-error-banner")).toContainText(
      "newer version",
    );
    const afterConflict = (
      await (await page.request.get(`/api/documents/${id}`)).json()
    ).document;
    expect(afterConflict.content).toEqual(remoteContent);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download draft", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe(
      "Autosave reliability test.md",
    );
    await page
      .getByRole("button", { name: "Discard draft & reload", exact: true })
      .click();
    await expect(page.locator(".collab-editor")).toContainText(
      "The collaborator’s newer version.",
    );
    await expect(page.locator(".save-error-banner")).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/documents/${id}`);
    await page.request.delete(`/api/documents/${id}?permanent=true`);
  }
});

test("database editing and authentication work when optional local storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked for test", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Abhay" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New document", exact: true })
    .last()
    .click();
  await expect(page.locator(".collab-editor")).toBeVisible();
  const id = page.url().split("/").pop()!;
  try {
    await page
      .getByRole("textbox", { name: "Document title", exact: true })
      .fill("Server persistence without local storage");
    await page
      .locator(".collab-editor")
      .fill("This document still saves to PostgreSQL.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".save-status")).toHaveText("All changes saved");
    await page.reload();
    await expect(page.locator(".collab-editor")).toContainText(
      "This document still saves to PostgreSQL.",
    );
    await expect(
      page.getByRole("textbox", { name: "Document title", exact: true }),
    ).toHaveValue("Server persistence without local storage");
  } finally {
    await page.request.delete(`/api/documents/${id}`);
    await page.request.delete(`/api/documents/${id}?permanent=true`);
  }
});
