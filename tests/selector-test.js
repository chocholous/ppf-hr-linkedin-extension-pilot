// Vlož tento kód do DevTools Console na LinkedIn stránce.
// Otestuje všechny selektory z content.js a vypíše výsledky.

(function() {
  console.clear();
  const url = location.href;
  let pageType = "unknown";
  if (/linkedin\.com\/in\//.test(url)) pageType = "profile";
  else if (/linkedin\.com\/search\//.test(url)) pageType = "search";
  else if (/linkedin\.com\/talent\//.test(url)) pageType = "recruiter";

  console.log(`%c=== PPF eRec Selector Test ===`, "font-size:16px;font-weight:bold;color:#d4a843");
  console.log(`URL: ${url}`);
  console.log(`Page type: ${pageType}\n`);

  // --- Profile selectors ---
  console.log(`%c--- PROFILE selectors ---`, "font-weight:bold;color:#66bb6a");

  // JSON-LD
  const jsonLd = document.querySelector('script[type="application/ld+json"]');
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd.textContent);
      console.log(`✅ JSON-LD found:`, data.name || data);
    } catch(e) {
      console.log(`⚠️ JSON-LD found but parse error:`, e.message);
    }
  } else {
    console.log(`❌ JSON-LD: not found`);
  }

  // H1 selectors
  const profileSelectors = [
    "h1.text-heading-xlarge",
    "h1.inline.t-24.v-align-middle",
    ".pv-top-card--list h1",
    ".ph5 h1",
    "section.artdeco-card h1",
    "main h1",
  ];
  profileSelectors.forEach(sel => {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    console.log(`${el ? '✅' : '❌'} ${sel}: ${text || 'not found'}`);
  });

  // --- Search selectors ---
  console.log(`\n%c--- SEARCH selectors ---`, "font-weight:bold;color:#66bb6a");
  const searchSelectors = [
    "span.entity-result__title-text a span[aria-hidden='true']",
    "a[data-view-name='search-result-lockup-title'] span[aria-hidden='true']",
    ".reusable-search__result-container span.entity-result__title-text a.app-aware-link span[dir='ltr'] span[aria-hidden='true']",
  ];
  searchSelectors.forEach(sel => {
    const els = document.querySelectorAll(sel);
    const names = Array.from(els).map(e => e.textContent.trim()).filter(t => t.length > 1);
    console.log(`${names.length > 0 ? '✅' : '❌'} ${sel}: ${names.length} names`, names.slice(0, 5));
  });

  // --- Recruiter selectors ---
  console.log(`\n%c--- RECRUITER selectors ---`, "font-weight:bold;color:#66bb6a");
  const recruiterSelectors = [
    ".artdeco-entity-lockup__content a",
    ".row__top-card .artdeco-entity-lockup__title a",
    ".artdeco-entity-lockup__title.ember-view a",
    "[data-test-row-lockup-full-name]",
  ];
  recruiterSelectors.forEach(sel => {
    const els = document.querySelectorAll(sel);
    const names = Array.from(els).map(e => e.textContent.trim()).filter(t => t.length > 1);
    console.log(`${names.length > 0 ? '✅' : '❌'} ${sel}: ${names.length} names`, names.slice(0, 5));
  });

  // --- Panel anchor selectors ---
  console.log(`\n%c--- PANEL ANCHOR selectors (kam vložit panel) ---`, "font-weight:bold;color:#66bb6a");
  const anchorSelectors = [".pv-top-card", ".ph5", "main section:first-child", "main"];
  anchorSelectors.forEach(sel => {
    const el = document.querySelector(sel);
    console.log(`${el ? '✅' : '❌'} ${sel}`);
  });

  // --- All H1 elements on page ---
  console.log(`\n%c--- Všechny H1 na stránce ---`, "font-weight:bold;color:#66bb6a");
  document.querySelectorAll("h1").forEach((el, i) => {
    console.log(`  h1[${i}]: class="${el.className}" text="${el.textContent.trim().substring(0, 80)}"`);
  });

  console.log(`\n%c=== Hotovo ===`, "font-size:14px;font-weight:bold;color:#d4a843");
})();
