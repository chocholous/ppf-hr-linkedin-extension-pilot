// Raw API test — calls PPF eRec directly from page context (bypassing extension)
// to see exactly what the API returns.

const { test, expect, EREC_WEB_URL } = require("./fixtures");

test.setTimeout(60_000);

test("raw PPF eRec API call", async ({ context }) => {
  const page = await context.newPage();

  // Navigate to PPF eRec first to have cookies
  await page.goto(EREC_WEB_URL, {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  console.log("Current URL:", page.url());

  // Try API endpoint
  const apiResult = await page.evaluate(async (webUrl) => {
    const urls = [
      `${webUrl}/api/candidates?perPage=40&firstname=Pavel&lastname=Chocholous`,
      `${webUrl}/candidates?perPage=40&firstname=Pavel&lastname=Chocholous`,
    ];
    const results = [];
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        });
        const text = await res.text();
        results.push({
          url,
          status: res.status,
          redirected: res.redirected,
          finalUrl: res.url,
          contentType: res.headers.get("content-type"),
          bodyLength: text.length,
          body: text.substring(0, 3000),
        });
      } catch (e) {
        results.push({ url, error: e.message });
      }
    }
    return results;
  }, EREC_WEB_URL);

  for (const r of apiResult) {
    console.log("\n===", r.url);
    console.log("Status:", r.status);
    console.log("Redirected:", r.redirected, "→", r.finalUrl);
    console.log("Content-Type:", r.contentType);
    console.log("Body length:", r.bodyLength);
    console.log("Body:\n", r.body);
  }
});
