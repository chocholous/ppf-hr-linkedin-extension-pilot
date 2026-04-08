// Custom Playwright fixtures for Chrome extension testing
const { test: base, chromium } = require("@playwright/test");
const path = require("path");

const EREC_DOMAIN = process.env.EREC_DOMAIN || "";
const EREC_WEB_URL = EREC_DOMAIN ? `https://web.${EREC_DOMAIN}` : "";
const EREC_API_URL = EREC_DOMAIN ? `https://api.${EREC_DOMAIN}` : "";

const test = base.extend({
  context: async ({}, use) => {
    const pathToExtension = path.join(
      __dirname,
      "..",
      "ppf-linkedin-extension"
    );
    const userDataDir = path.join(__dirname, "..", ".playwright-profile");
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker)
      serviceWorker = await context.waitForEvent("serviceworker");
    const extensionId = serviceWorker.url().split("/")[2];
    await use(extensionId);
  },
});

const expect = test.expect;

module.exports = { test, expect, EREC_DOMAIN, EREC_WEB_URL, EREC_API_URL };
