// content.js — Injected into LinkedIn pages (profiles, search, recruiter)
// Extracts person names and looks them up in PPF eRec.

(async function () {
  "use strict";

  const DEBUG = false;
  const LOG = (...args) => { if (DEBUG) console.log("[PPF eRec]", ...args); };
  const WARN = (...args) => console.warn("[PPF eRec]", ...args);

  const CONTAINER_ID = "ppf-erec-panel";
  const POLL_INTERVAL = 1500;
  const MAX_POLLS = 20;
  const RETRY_DELAY = 10000;
  const MAX_RETRIES = 3;

  // Load config from background
  let erecConfig = null;
  try {
    erecConfig = await chrome.runtime.sendMessage({ action: "getConfig" });
  } catch (e) {
    WARN("Failed to load config:", e.message);
  }
  if (!erecConfig) {
    LOG("Extension not configured yet, skipping.");
    return;
  }

  let lastUrl = location.href;

  LOG("Content script loaded", location.href);

  // LinkedIn SPA — watch URL changes
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      LOG("URL changed:", lastUrl, "→", location.href);
      lastUrl = location.href;
      removeAllPanels();
      const type = getPageType();
      if (type) {
        LOG("Page type:", type);
        waitAndRun();
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const initialType = getPageType();
  if (initialType) {
    LOG("Initial page type:", initialType);
    waitAndRun();
  }

  // --- Page type detection ---

  function getPageType() {
    const url = location.href;
    if (/linkedin\.com\/in\/[^/]+/.test(url)) return "profile";
    if (/linkedin\.com\/search\//.test(url)) return "search";
    if (/linkedin\.com\/talent\//.test(url)) return "recruiter";
    return null;
  }

  // --- Name extraction: Profile ---

  function extractNameFromProfile() {
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        if (data && data.name && data.name.trim().length > 1) {
          LOG("Name from JSON-LD:", data.name.trim());
          return data.name.trim();
        }
        if (Array.isArray(data["@graph"])) {
          const person = data["@graph"].find((x) => x["@type"] === "Person");
          if (person && person.name) return person.name.trim();
        }
      } catch (e) {}
    }

    const selectors = [
      "h1.text-heading-xlarge",
      "h1.inline.t-24.v-align-middle",
      ".pv-top-card--list h1",
      ".ph5 h1",
      "main h1",
      "main h2",
      "h2",
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent.trim();
        if (text.length > 1 && text.length < 60 && !text.includes("\n")) {
          const words = text.split(/\s+/);
          if (words.length >= 2 && /^[\p{L}\s.\-']+$/u.test(text)) {
            LOG("Name from selector", sel, ":", text);
            return text;
          }
        }
      }
    }

    const allH = document.querySelectorAll("h1, h2");
    if (allH.length > 0) {
      LOG("Headings found but none matched:");
      allH.forEach((h, i) => LOG(`  ${h.tagName}[${i}] text="${h.textContent.trim().substring(0, 60)}"`));
    } else {
      LOG("No h1/h2 on page yet");
    }
    return null;
  }

  // --- Name extraction: Search results ---

  function findSearchNameElements() {
    const nameEls = [];
    const seen = new Set();

    const profileLinks = document.querySelectorAll('a[href*="/in/"], a[href*="/talent/profile/"]');
    for (const link of profileLinks) {
      const href = (link.getAttribute("href") || "").split("?")[0];
      if (!/\/(in|talent\/profile)\/[^/]+/.test(href)) continue;
      if (seen.has(href)) continue;
      if (link.querySelector("div, figure, img, section")) continue;

      const name = link.textContent.trim();
      if (name.length < 3 || name.length > 60) continue;
      if (name.split(/\s+/).length < 2) continue;

      seen.add(href);
      nameEls.push({ el: link, name, href });
    }

    return nameEls;
  }

  // --- Main logic ---

  function waitAndRun() {
    let pollCount = 0;
    const pageType = getPageType();
    LOG(`Polling for "${pageType}"`);

    const timer = setInterval(() => {
      pollCount++;
      if (pageType === "profile") {
        const name = extractNameFromProfile();
        if (name || pollCount >= MAX_POLLS) {
          clearInterval(timer);
          if (name) injectProfileBadge(name);
          else WARN("Gave up — no name found");
        }
      } else {
        const nameEls = findSearchNameElements();
        if (nameEls.length > 0 || pollCount >= MAX_POLLS) {
          clearInterval(timer);
          if (nameEls.length > 0) {
            LOG(`Found ${nameEls.length} names in search`);
            injectSearchBadges(nameEls);
          } else {
            WARN("Gave up — no names in search");
          }
        }
      }
    }, POLL_INTERVAL);
  }

  // --- Shared: render candidate card content ---

  function renderCandidateRow(c, parsed) {
    const url = c.url || buildSearchUrl(parsed.firstName, parsed.lastName);
    let actions = "";

    actions += `<a class="ppf-search-link" href="${esc(url)}" target="_blank" rel="noopener">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>`;

    if (c.phone) {
      actions += `<span class="ppf-search-action ppf-search-phone" data-phone="${esc(c.phone)}" title="Kopírovat ${esc(c.phone)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        ${esc(c.phone)}
      </span>`;
    }

    if (c.email) {
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(c.email)}`;
      actions += `<a class="ppf-search-action ppf-search-email" href="${esc(outlookUrl)}" target="_blank" rel="noopener" title="${esc(c.email)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      </a>`;
    }

    return `<div class="ppf-search-row">${actions}</div>`;
  }

  function renderCardContent(candidates, parsed) {
    const MAX_VISIBLE = 2;
    const visible = candidates.slice(0, MAX_VISIBLE);
    const hidden = candidates.slice(MAX_VISIBLE);

    let html = `<span class="ppf-search-logo">eRec</span>`;
    html += `<div class="ppf-search-rows">`;
    html += visible.map((c) => renderCandidateRow(c, parsed)).join("");

    if (hidden.length > 0) {
      html += `<div class="ppf-search-hidden" style="display:none;">`;
      html += hidden.map((c) => renderCandidateRow(c, parsed)).join("");
      html += `</div>`;
      html += `<button class="ppf-search-expand" title="Zobrazit dalších ${hidden.length}">
        +${hidden.length}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,9 12,15 18,9"/></svg>
      </button>`;
    }
    html += `</div>`;
    return html;
  }

  function bindCardEvents(card, hiddenCount) {
    card.addEventListener("click", (e) => { e.stopPropagation(); });

    const expandBtn = card.querySelector(".ppf-search-expand");
    if (expandBtn) {
      expandBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hiddenEl = card.querySelector(".ppf-search-hidden");
        if (hiddenEl.style.display === "none") {
          hiddenEl.style.display = "block";
          expandBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,15 12,9 18,15"/></svg>`;
          expandBtn.title = "Skrýt";
        } else {
          hiddenEl.style.display = "none";
          expandBtn.innerHTML = `+${hiddenCount} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,9 12,15 18,9"/></svg>`;
          expandBtn.title = `Zobrazit dalších ${hiddenCount}`;
        }
      });
    }

    card.querySelectorAll(".ppf-search-phone").forEach((phoneEl) => {
      phoneEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(phoneEl.dataset.phone).then(() => {
          phoneEl.classList.add("ppf-copied");
          setTimeout(() => phoneEl.classList.remove("ppf-copied"), 1500);
        });
      });
    });

    card.querySelectorAll(".ppf-search-link").forEach((linkEl) => {
      linkEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(linkEl.href, "_blank", "noopener");
      });
    });
  }

  // --- Shared: lookup with auto-retry ---

  function lookupCandidate(parsed, card, retryCount) {
    chrome.runtime.sendMessage(
      { action: "searchCandidate", firstName: parsed.firstName, lastName: parsed.lastName },
      (response) => {
        if (!response || !response.ok) {
          const isRetryable = response && (response.error === "NOT_LOGGED_IN" || response.error === "NOT_CONFIGURED");
          if (!isRetryable && retryCount < MAX_RETRIES) {
            // Transient error — retry
            setTimeout(() => lookupCandidate(parsed, card, retryCount + 1), RETRY_DELAY);
            return;
          }
          card.className = "ppf-search-card ppf-search-error";
          card.innerHTML = '<span class="ppf-search-logo">eRec</span>';
          card.title = response ? (response.error === "NOT_LOGGED_IN" ? "Nepřihlášen do PPF eRec" : response.error) : "Chyba spojení";
          // Auto-retry for login errors too (user might log in later)
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
              card.className = "ppf-search-card ppf-search-loading";
              card.innerHTML = '<span class="ppf-search-logo">eRec</span>';
              card.title = "";
              lookupCandidate(parsed, card, retryCount + 1);
            }, RETRY_DELAY);
          }
          return;
        }

        const candidates = response.candidates || [];
        if (candidates.length === 0) {
          card.className = "ppf-search-card ppf-search-empty";
          card.innerHTML = '<span class="ppf-search-logo">eRec</span>';
          card.title = "Nenalezeno v PPF eRec";
          return;
        }

        card.className = "ppf-search-card ppf-search-found";
        card.innerHTML = renderCardContent(candidates, parsed);
        bindCardEvents(card, candidates.length - 2);

        LOG("Card:", parsed.firstName.charAt(0) + "." + parsed.lastName.charAt(0) + ".", "→", candidates.length, "found");
      }
    );
  }

  // --- Profile: badge under name ---

  function injectProfileBadge(fullName) {
    removeAllPanels();
    const parsed = parseName(fullName);
    if (!parsed) return;
    LOG("Parsed:", parsed);

    const nameEl = document.querySelector("h1.text-heading-xlarge")
      || document.querySelector("main h1")
      || document.querySelector("main h2");

    const card = document.createElement("div");
    card.id = CONTAINER_ID;
    card.className = "ppf-search-card ppf-search-loading ppf-profile-card";
    card.innerHTML = '<span class="ppf-search-logo">eRec</span>';

    if (nameEl) {
      // Don't insert near h2 — it's buried in nested flex containers.
      // Instead, find the profile's top card section and insert after name area.
      const section = nameEl.closest("section")
        || nameEl.closest("[data-member-id]")
        || nameEl.closest("main > div > div");

      let inserted = false;
      if (section) {
        // Find first <p> with real text — that's the bio/headline
        const paragraphs = section.querySelectorAll("p");
        for (const p of paragraphs) {
          const text = p.textContent.trim();
          if (text.length > 10 && !p.closest("h1, h2, button, a[href='/']")) {
            p.before(card);
            inserted = true;
            break;
          }
        }
      }
      if (!inserted) {
        nameEl.after(card);
      }
    }

    lookupCandidate(parsed, card, 0);
  }

  // --- Search / Recruiter: inline badges ---

  function injectSearchBadges(nameEls) {
    LOG(`Injecting badges for ${nameEls.length} names`);

    nameEls.forEach(({ el, name }) => {
      if (el.parentNode.querySelector(".ppf-search-card")) return;

      const parsed = parseName(name);
      if (!parsed) return;

      const card = document.createElement("span");
      card.className = "ppf-search-card ppf-search-loading";
      card.innerHTML = '<span class="ppf-search-logo">eRec</span>';
      el.after(card);

      lookupCandidate(parsed, card, 0);
    });
  }

  // --- Helpers ---

  function parseName(fullName) {
    let clean = fullName.split(",")[0].trim();
    clean = clean.replace(/\s+(MBA|PhD|Ph\.D|CSc|Ing|Mgr|Bc|JUDr|MUDr|RNDr|PaedDr|Dr|Prof)\.?\s*$/gi, "").trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 0) return null;
    if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }

  function removeAllPanels() {
    const panel = document.getElementById(CONTAINER_ID);
    if (panel) panel.remove();
    document.querySelectorAll(".ppf-badge, .ppf-search-card").forEach((b) => b.remove());
  }

  function buildSearchUrl(firstName, lastName) {
    const params = new URLSearchParams({ perPage: "40", firstname: firstName, lastname: lastName });
    return `${erecConfig.WEB_URL}/candidates?${params.toString()}`;
  }

  function esc(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
