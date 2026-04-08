// Debug test — mock LinkedIn, real PPF eRec API.
// First login to PPF eRec, then test extension.

const { test, expect, EREC_WEB_URL } = require("./fixtures");
const path = require("path");
const fs = require("fs");

const MOCK_HTML = fs.readFileSync(
  path.join(__dirname, "mock-linkedin-profile.html"),
  "utf-8"
);

test.setTimeout(180_000);

test("capture PPF eRec API response", async ({ context, extensionId }) => {
  console.log(`Extension ID: ${extensionId}`);

  // Get service worker for logging
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");
  sw.on("console", (msg) => console.log(`[SW] ${msg.text()}`));

  // Login to PPF eRec first
  const loginPage = await context.newPage();
  await loginPage.goto(EREC_WEB_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (loginPage.url().includes("/login")) {
    console.log("⏳ Waiting for PPF eRec login...");
    await loginPage.waitForURL((url) => !url.toString().includes("/login"), {
      timeout: 120_000,
    });
  }
  console.log("✅ PPF eRec logged in");

  // Now test extension with mock LinkedIn
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.text().includes("PPF eRec")) console.log(`[CS] ${msg.text()}`);
  });

  await context.route("**/www.linkedin.com/in/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: MOCK_HTML,
    });
  });

  await page.goto("https://www.linkedin.com/in/pavel-chocholous/");

  const panel = page.locator("#ppf-erec-panel");
  await expect(panel).toBeVisible({ timeout: 60_000 });

  const status = panel.locator(".ppf-status");
  await expect(status).not.toHaveText("Hledám…", { timeout: 30_000 });

  console.log(`\nStatus: ${await status.textContent()}`);
  console.log(`Panel HTML:\n${await panel.innerHTML()}`);
});
