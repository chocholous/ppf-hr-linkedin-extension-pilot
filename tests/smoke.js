// Minimal smoke test — just opens Chrome with extension and keeps it open.
const { chromium } = require("@playwright/test");
const path = require("path");

(async () => {
  const pathToExtension = path.join(__dirname, "..", "ppf-linkedin-extension");
  const userDataDir = path.join(__dirname, "..", ".playwright-profile");

  console.log("🚀 Spouštím Chrome s extension...");
  console.log(`   Extension: ${pathToExtension}`);
  console.log(`   Profile: ${userDataDir}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  // Check service worker
  let [sw] = context.serviceWorkers();
  if (!sw) {
    console.log("⏳ Čekám na service worker...");
    sw = await context.waitForEvent("serviceworker", { timeout: 10000 }).catch(() => null);
  }
  if (sw) {
    console.log(`✅ Extension loaded: ${sw.url()}`);
  } else {
    console.log("❌ Service worker se nenačetl");
  }

  // Open a page
  const page = await context.newPage();
  await page.goto("chrome://extensions/");
  console.log("\n📋 Otevřena chrome://extensions — ověř, že extension je tam.");
  console.log("🔓 Zavři Chrome ručně až budeš hotový.\n");

  // Keep alive
  await new Promise(() => {});
})();
