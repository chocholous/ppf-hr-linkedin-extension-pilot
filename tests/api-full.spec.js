// Full test — login to PPF eRec, verify token cookie, then test extension.

const { test, expect, EREC_WEB_URL, EREC_DOMAIN } = require("./fixtures");
const path = require("path");
const fs = require("fs");

const MOCK_HTML = fs.readFileSync(
  path.join(__dirname, "mock-linkedin-profile.html"),
  "utf-8"
);

test.setTimeout(180_000);

test("full flow: login → token → extension", async ({ context, extensionId }) => {
  console.log(`Extension ID: ${extensionId}`);

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker");
  sw.on("console", (msg) => console.log(`[SW] ${msg.text()}`));

  // Step 1: Login to PPF eRec
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
  console.log("✅ PPF eRec logged in, URL:", loginPage.url());

  // Step 2: Verify cookies
  const cookies = await context.cookies();
  const tokenCookie = cookies.find(c => c.name === "erec_token");
  console.log("\n=== Token cookie ===");
  if (tokenCookie) {
    console.log(`  domain: ${tokenCookie.domain}`);
    console.log(`  value: ${tokenCookie.value.substring(0, 30)}...`);
    console.log(`  httpOnly: ${tokenCookie.httpOnly}`);
    console.log(`  secure: ${tokenCookie.secure}`);
    console.log(`  sameSite: ${tokenCookie.sameSite}`);
  } else {
    console.log("  ❌ NOT FOUND");
    console.log("  All cookies:", cookies.filter(c => c.domain.includes(EREC_DOMAIN)).map(c => `${c.name} (${c.domain})`));
  }

  // Step 3: Test extension
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

  const statusText = await status.textContent();
  console.log(`\n📊 Status: ${statusText}`);
  console.log(`Panel:\n${await panel.innerHTML()}`);
});
