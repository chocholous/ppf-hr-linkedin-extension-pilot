// PPF eRec LinkedIn Matcher — E2E tests with mocked LinkedIn + PPF eRec
//
// Playwright routes www.linkedin.com/in/* to local mock HTML.
// PPF eRec API responses are intercepted and mocked.
// Extension content script runs against the mock page as if it were real LinkedIn.

const { test, expect, EREC_WEB_URL, EREC_DOMAIN } = require("./fixtures");
const path = require("path");
const fs = require("fs");

const MOCK_PROFILE_HTML = fs.readFileSync(
  path.join(__dirname, "mock-linkedin-profile.html"),
  "utf-8"
);

function mockHtmlWithName(name) {
  return MOCK_PROFILE_HTML.replace("Pavel Chocholous", name);
}

/** Setup route mocks on a BrowserContext (not page — to also catch service worker fetches) */
async function setupRoutes(context, page, { candidates = [], profileName = "Pavel Chocholous" } = {}) {
  const html = mockHtmlWithName(profileName);

  // Mock LinkedIn profile — on context level so content script sees it
  await context.route("**/www.linkedin.com/in/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: html,
    });
  });

  // Mock PPF eRec JSON API — on context level so background.js fetch is caught
  await context.route(`**/web.${EREC_DOMAIN}/api/candidates**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: candidates }),
    });
  });

  // Mock HTML fallback
  await context.route(`**/web.${EREC_DOMAIN}/candidates**`, (route) => {
    if (route.request().url().includes("/api/")) return route.continue();
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body></body></html>",
    });
  });
}

test.describe("PPF eRec LinkedIn Matcher", () => {
  test("extension service worker loads", async ({ extensionId }) => {
    expect(extensionId).toBeTruthy();
    console.log(`✅ Extension ID: ${extensionId}`);
  });

  test("panel shows matched candidate", async ({ context }) => {
    const page = await context.newPage();
    await setupRoutes(context, page, {
      candidates: [
        {
          id: 12345,
          firstname: "Pavel",
          lastname: "Chocholous",
          phone: "+420724312216",
          email: "pavel@example.com",
        },
      ],
    });

    await page.goto("https://www.linkedin.com/in/pavel-chocholous/");

    const panel = page.locator("#ppf-erec-panel");
    await expect(panel).toBeVisible({ timeout: 45_000 });

    // Wait for loading to finish
    const status = panel.locator(".ppf-status");
    await expect(status).not.toHaveText("Hledám…", { timeout: 30_000 });

    await expect(status).toHaveText(/nalezen/i);

    const link = panel.locator(".ppf-candidate");
    await expect(link).toContainText("Pavel Chocholous");
    await expect(link).toContainText("+420724312216");

    const href = await link.getAttribute("href");
    expect(href).toContain(`web.${EREC_DOMAIN}/candidates/12345`);
  });

  test("panel shows Nenalezeno when no candidates", async ({ context }) => {
    const page = await context.newPage();
    await setupRoutes(context, page, { candidates: [] });

    await page.goto("https://www.linkedin.com/in/pavel-chocholous/");

    const panel = page.locator("#ppf-erec-panel");
    await expect(panel).toBeVisible({ timeout: 45_000 });

    const status = panel.locator(".ppf-status");
    await expect(status).not.toHaveText("Hledám…", { timeout: 30_000 });
    await expect(status).toHaveText(/nenalezeno/i);

    const manualLink = panel.locator(".ppf-no-results a");
    await expect(manualLink).toBeVisible();
  });

  test("panel shows error on 401 (not logged in)", async ({ context }) => {
    const page = await context.newPage();

    // Mock LinkedIn
    await context.route("**/www.linkedin.com/in/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: MOCK_PROFILE_HTML,
      });
    });

    // Mock PPF eRec — 401
    await context.route(`**/web.${EREC_DOMAIN}/**`, (route) => {
      route.fulfill({ status: 401, body: "Unauthorized" });
    });

    await page.goto("https://www.linkedin.com/in/pavel-chocholous/");

    const panel = page.locator("#ppf-erec-panel");
    await expect(panel).toBeVisible({ timeout: 45_000 });

    const status = panel.locator(".ppf-status");
    await expect(status).not.toHaveText("Hledám…", { timeout: 30_000 });
    await expect(status).toHaveText(/nepřihlášen|chyba/i);
  });

  test("strips academic titles from name", async ({ context }) => {
    const page = await context.newPage();

    let capturedUrls = [];
    await context.route("**/www.linkedin.com/in/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: mockHtmlWithName("Jan Novák, MBA"),
      });
    });
    await context.route(`**/web.${EREC_DOMAIN}/api/candidates**`, (route) => {
      capturedUrls.push(route.request().url());
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ id: 999, firstname: "Jan", lastname: "Novák", phone: "+420111222333" }] }),
      });
    });
    await context.route(`**/web.${EREC_DOMAIN}/candidates**`, (route) => {
      if (route.request().url().includes("/api/")) return route.continue();
      route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" });
    });

    await page.goto("https://www.linkedin.com/in/jan-novak/");

    const panel = page.locator("#ppf-erec-panel");
    await expect(panel).toBeVisible({ timeout: 45_000 });

    // Verify MBA was stripped — API should get firstname=Jan, not "Jan Novák, MBA"
    expect(capturedUrls.length).toBeGreaterThan(0);
    const allParams = capturedUrls.map((u) => {
      const url = new URL(u);
      return { firstname: url.searchParams.get("firstname"), lastname: url.searchParams.get("lastname") };
    });
    console.log("📡 API calls:", allParams);

    // One of the calls should have firstname=Jan, lastname=Novák
    const hasCorrect = allParams.some(
      (p) => (p.firstname === "Jan" && p.lastname === "Novák") || (p.firstname === "Novák" && p.lastname === "Jan")
    );
    expect(hasCorrect).toBe(true);
  });
});
