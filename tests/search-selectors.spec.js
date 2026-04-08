// Find name elements in LinkedIn search by analyzing profile links

const { test, expect } = require("./fixtures");

test.setTimeout(180_000);

test("discover search name elements", async ({ context }) => {
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded", timeout: 30_000,
  });
  if (page.url().includes("/login") || page.url().includes("/authwall") || page.url().includes("/checkpoint")) {
    console.log("⏳ LinkedIn login...");
    await page.waitForURL(url => {
      const s = url.toString();
      return !s.includes("/login") && !s.includes("/authwall") && !s.includes("/checkpoint");
    }, { timeout: 120_000 });
  }
  console.log("✅ LinkedIn OK");

  await page.goto("https://www.linkedin.com/search/results/people/?keywords=chocholous", {
    waitUntil: "domcontentloaded", timeout: 30_000,
  });
  await page.waitForTimeout(8_000);

  const data = await page.evaluate(() => {
    // Find all links to /in/ profiles
    const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
    const results = [];

    for (const link of profileLinks.slice(0, 20)) {
      const href = link.getAttribute("href");
      // Skip nav/sidebar links
      if (!href.includes("/in/")) continue;

      // Get all text content in this link
      const texts = [];
      link.querySelectorAll("*").forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 1 && t.length < 60 && !texts.includes(t)) {
          texts.push({ tag: el.tagName, class: el.className.substring(0, 40), text: t });
        }
      });

      // Get parent card (go up to find the list item)
      let card = link;
      for (let i = 0; i < 10; i++) {
        if (card.parentElement) card = card.parentElement;
        if (card.tagName === "LI") break;
      }

      results.push({
        href: href.substring(0, 60),
        linkTag: link.tagName,
        linkClass: link.className.substring(0, 60),
        linkHTML: link.innerHTML.substring(0, 500),
        children: texts.slice(0, 5),
        cardTag: card.tagName,
        cardClass: card.className.substring(0, 60),
      });
    }

    return results;
  });

  for (const r of data) {
    console.log(`\n=== ${r.href} ===`);
    console.log(`  link: <${r.linkTag}> class="${r.linkClass}"`);
    console.log(`  card: <${r.cardTag}> class="${r.cardClass}"`);
    console.log(`  children:`);
    r.children.forEach(c => console.log(`    <${c.tag}> class="${c.class}" text="${c.text}"`));
    console.log(`  HTML: ${r.linkHTML}`);
  }
});
