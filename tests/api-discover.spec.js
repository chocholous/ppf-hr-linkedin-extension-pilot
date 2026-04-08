// Discover auth headers the SPA sends to eRec API

const { test, expect, EREC_WEB_URL, EREC_API_URL, EREC_DOMAIN } = require("./fixtures");

test.setTimeout(180_000);

test("discover API auth mechanism", async ({ context }) => {
  const page = await context.newPage();

  // Login first
  await page.goto(EREC_WEB_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (page.url().includes("/login")) {
    console.log("⏳ Waiting for login...");
    await page.waitForURL((url) => !url.toString().includes("/login"), {
      timeout: 120_000,
    });
  }
  console.log("✅ Logged in");

  // Capture request headers to API
  page.on("request", (req) => {
    if (req.url().includes(EREC_API_URL)) {
      console.log(`\n>>> ${req.method()} ${req.url()}`);
      const headers = req.headers();
      for (const [key, value] of Object.entries(headers)) {
        if (
          key.includes("auth") ||
          key.includes("token") ||
          key.includes("cookie") ||
          key.includes("bearer") ||
          key === "authorization" ||
          key === "x-xsrf-token" ||
          key === "x-csrf-token"
        ) {
          // Mask sensitive values
          const masked = value.length > 20 ? value.substring(0, 20) + "..." : value;
          console.log(`   ${key}: ${masked}`);
        }
      }
      // Also show all non-standard headers
      for (const [key, value] of Object.entries(headers)) {
        if (key.startsWith("x-") || key === "authorization") {
          const masked = value.length > 40 ? value.substring(0, 40) + "..." : value;
          console.log(`   [header] ${key}: ${masked}`);
        }
      }
    }
  });

  // Navigate to candidates page to trigger API calls
  console.log("\nNavigating to candidates page...");
  await page.goto(
    `${EREC_WEB_URL}/candidates?firstname=Pavel&lastname=Chocholous`,
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );

  await page.waitForTimeout(10_000);

  // Also dump cookies for both domains
  const cookies = await context.cookies();
  console.log("\n=== COOKIES ===");
  for (const c of cookies) {
    if (c.domain.includes(EREC_DOMAIN)) {
      console.log(`  ${c.domain} | ${c.name} = ${c.value.substring(0, 30)}...`);
    }
  }

  // Check localStorage
  const storage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.includes("token") || key.includes("auth") || key.includes("user")) {
        items[key] = localStorage.getItem(key).substring(0, 50) + "...";
      }
    }
    return items;
  });
  console.log("\n=== LOCAL STORAGE (token/auth keys) ===");
  console.log(JSON.stringify(storage, null, 2));
});
