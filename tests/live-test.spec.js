// Live test — real LinkedIn + real PPF eRec, persistent profile.
// First run: log in to both systems manually. Subsequent runs: auto.

const { test, expect, EREC_WEB_URL } = require("./fixtures");

test.describe("PPF eRec LinkedIn Matcher — LIVE", () => {
  test.setTimeout(300_000);

  test("extension works on real LinkedIn profile", async ({
    context,
    extensionId,
  }) => {
    console.log(`\n✅ Extension ID: ${extensionId}`);

    // Check if already logged in to PPF eRec
    const erecPage = await context.newPage();
    await erecPage.goto(EREC_WEB_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    if (erecPage.url().includes("/login")) {
      console.log("⏳ PPF eRec — čekám na přihlášení...");
      await erecPage.waitForURL((url) => !url.toString().includes("/login"), {
        timeout: 120_000,
      });
    }
    console.log("✅ PPF eRec OK");

    // Check if already logged in to LinkedIn
    const liPage = await context.newPage();
    await liPage.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    if (
      liPage.url().includes("/login") ||
      liPage.url().includes("/authwall") ||
      liPage.url().includes("/checkpoint")
    ) {
      console.log("⏳ LinkedIn — čekám na přihlášení...");
      await liPage.waitForURL(
        (url) => {
          const s = url.toString();
          return (
            !s.includes("/login") &&
            !s.includes("/authwall") &&
            !s.includes("/checkpoint")
          );
        },
        { timeout: 120_000 }
      );
    }
    console.log("✅ LinkedIn OK");

    // Navigate to profile
    console.log("\n📋 Jdu na LinkedIn profil...");
    await liPage.goto("https://www.linkedin.com/in/pavel-chocholous/", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Give SPA time to render
    await liPage.waitForTimeout(5_000);
    console.log(`🔗 URL: ${liPage.url()}`);

    // Dump h1 elements for diagnostics
    const h1s = await liPage.evaluate(() =>
      Array.from(document.querySelectorAll("h1")).map((el) => ({
        class: el.className,
        text: el.textContent.trim().substring(0, 80),
      }))
    );
    console.log(`📝 H1 elementy: ${JSON.stringify(h1s)}`);

    // Check if content script CSS was injected
    const hasCSS = await liPage.evaluate(() => {
      return !!document.getElementById("ppf-erec-panel") ||
        Array.from(document.styleSheets).some((s) => {
          try {
            return Array.from(s.cssRules).some(
              (r) => r.selectorText && r.selectorText.includes("ppf-")
            );
          } catch {
            return false;
          }
        });
    });
    console.log(`📄 Content script injektován: ${hasCSS}`);

    // Wait for PPF panel
    console.log("⏳ Čekám na PPF panel...");
    const panel = liPage.locator("#ppf-erec-panel");
    await expect(panel).toBeVisible({ timeout: 60_000 });

    // Wait for result
    const status = panel.locator(".ppf-status");
    await expect(status).not.toHaveText("Hledám…", { timeout: 30_000 });

    const statusText = await status.textContent();
    const candidateCount = await panel.locator(".ppf-candidate").count();
    console.log(`\n📊 Status: ${statusText}`);
    console.log(`👤 Kandidátů: ${candidateCount}`);

    if (candidateCount > 0) {
      const links = await panel.locator(".ppf-candidate").all();
      for (const link of links) {
        const text = await link.textContent();
        const href = await link.getAttribute("href");
        console.log(`   → ${text?.trim()}  ${href}`);
      }
    }

    expect(statusText).toBeTruthy();
  });
});
