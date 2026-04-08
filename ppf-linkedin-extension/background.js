// background.js — PPF eRec candidate lookup
// Auth: Bearer token from erec_token cookie

const DEBUG = false;
const LOG = (...args) => { if (DEBUG) console.log("[PPF eRec]", ...args); };
const WARN = (...args) => console.warn("[PPF eRec]", ...args);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- Config from chrome.storage.local ---

async function getConfig() {
  const { erecDomain } = await chrome.storage.local.get("erecDomain");
  if (!erecDomain) return null;
  return {
    WEB_URL: `https://web.${erecDomain}`,
    API_BASE: `https://api.${erecDomain}/api/v1/grids/candidates`,
    COOKIE_DOMAIN: erecDomain,
  };
}

// --- Cache ---

const cache = new Map();

function cacheKey(firstName, lastName) {
  return `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
}

function cacheGet(firstName, lastName) {
  const key = cacheKey(firstName, lastName);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(firstName, lastName, data) {
  const key = cacheKey(firstName, lastName);
  cache.set(key, { data, ts: Date.now() });
}

// --- Token & expiry ---

async function getToken() {
  const config = await getConfig();
  if (!config) return null;
  try {
    const cookie = await chrome.cookies.get({
      url: config.WEB_URL,
      name: "erec_token",
    });
    LOG("Cookie lookup result:", cookie ? "found" : "null");
    if (cookie && cookie.value) {
      const token = decodeURIComponent(cookie.value);
      const exp = getJwtExpiry(token);
      if (exp && exp < Date.now() / 1000) {
        WARN("Token expired at", new Date(exp * 1000).toISOString());
        return null;
      }
      return token;
    }
  } catch (e) {
    WARN("Cookie access error:", e.message);
  }
  return null;
}

function getJwtExpiry(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp || null;
  } catch (e) {
    return null;
  }
}

// --- Badge: login status indicator ---

async function updateBadge() {
  const config = await getConfig();
  if (!config) {
    chrome.action.setTitle({ title: "PPF eRec — nenastaveno" });
    return;
  }

  const token = await getToken();
  const title = token ? "PPF eRec — přihlášen" : "PPF eRec — nepřihlášen";

  chrome.action.setBadgeText({ text: "" });
  chrome.action.setTitle({ title });

  const size = 16;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const resp = await fetch(chrome.runtime.getURL("icon16.png"));
  const blob = await resp.blob();
  const bmp = await createImageBitmap(blob);
  ctx.drawImage(bmp, 0, 0, size, size);

  const r = 3;
  const cx = size - r - 1;
  const cy = size - r - 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = token ? "#22c55e" : "#ef4444";
  ctx.fill();

  const imageData = ctx.getImageData(0, 0, size, size);
  chrome.action.setIcon({ imageData: { 16: imageData } });
}

// Open welcome/setup page on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "welcome.html" });
  }
});

// Check on startup
updateBadge();

// Use chrome.alarms instead of setInterval (MV3 service worker sleeps)
chrome.alarms.create("checkLogin", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkLogin") updateBadge();
});

// Check when any cookie on eRec domain changes
chrome.cookies.onChanged.addListener(async (changeInfo) => {
  const config = await getConfig();
  if (config && changeInfo.cookie.domain.includes(config.COOKIE_DOMAIN)) {
    updateBadge();
  }
});

// Also refresh on tab switch
chrome.tabs.onActivated.addListener(() => updateBadge());

// Re-check when config changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.erecDomain) {
    updateBadge();
  }
});

// --- Message handler ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getConfig") {
    getConfig().then((config) => sendResponse(config));
    return true;
  }
  if (request.action !== "searchCandidate") return false;
  handleSearch(request.firstName, request.lastName, sendResponse);
  return true;
});

async function handleSearch(firstName, lastName, sendResponse) {
  const config = await getConfig();
  if (!config) {
    sendResponse({ ok: false, error: "NOT_CONFIGURED" });
    return;
  }

  try {
    LOG("Search:", firstName.charAt(0) + ".", lastName.charAt(0) + ".");

    const cached = cacheGet(firstName, lastName);
    if (cached) {
      LOG("Cache hit:", cached.length, "candidates");
      sendResponse({ ok: true, candidates: cached });
      return;
    }

    const token = await getToken();
    LOG("Token:", token ? token.substring(0, 5) + "***" : "NOT FOUND");

    if (!token) {
      sendResponse({ ok: false, error: "NOT_LOGGED_IN" });
      return;
    }

    const queries = [
      { firstname: firstName, lastname: lastName },
      { firstname: lastName, lastname: firstName },
    ];

    const results = await Promise.all(
      queries.map((q) => fetchWithRetry(q, token, config))
    );

    const seen = new Set();
    const merged = [];
    for (const list of results) {
      for (const c of list) {
        const key = c.id || `${c.firstname}-${c.lastname}-${c.phone}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(c);
        }
      }
    }

    LOG("Results:", merged.length, "candidates");
    cacheSet(firstName, lastName, merged);
    sendResponse({ ok: true, candidates: merged });
  } catch (err) {
    WARN("Error:", err.message);
    if (err.message === "NOT_LOGGED_IN") updateBadge();
    sendResponse({ ok: false, error: err.message });
  }
}

// --- Fetch with retry + backoff ---

async function fetchWithRetry(query, token, config, retries = 1) {
  try {
    return await fetchCandidates(query, token, config);
  } catch (err) {
    if (retries > 0 && err.message !== "NOT_LOGGED_IN") {
      WARN("Retry after error:", err.message);
      await new Promise((r) => setTimeout(r, 1000));
      return fetchWithRetry(query, token, config, retries - 1);
    }
    throw err;
  }
}

async function fetchCandidates({ firstname, lastname }, token, config) {
  const url = new URL(config.API_BASE);
  url.searchParams.set("perPage", "40");
  url.searchParams.set("firstname", firstname);
  url.searchParams.set("lastname", lastname);

  LOG("Fetching candidates…");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  LOG("Response:", res.status);

  if (res.status === 401 || res.status === 403) {
    throw new Error("NOT_LOGGED_IN");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  const items = data.data || [];
  LOG("Items found:", items.length);

  return items.map((c) => normalizeCandidate(c, config));
}

function normalizeCandidate(c, config) {
  return {
    id: c.id || null,
    firstname: c.firstname || "",
    lastname: c.lastname || "",
    phone: c.phone || "",
    email: c.email || "",
    linkedin: c.linkedin || "",
    url: c.id
      ? `${config.WEB_URL}/candidates/${c.id}`
      : null,
  };
}
