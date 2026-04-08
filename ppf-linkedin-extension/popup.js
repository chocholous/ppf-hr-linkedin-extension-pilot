// popup.js — Check login status and update popup UI

(async function () {
  const statusEl = document.getElementById("status");
  const hintEl = document.getElementById("login-hint");

  // Load config
  const config = await chrome.runtime.sendMessage({ action: "getConfig" });

  if (!config) {
    statusEl.className = "status status-err";
    statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Nenastaveno</span>';
    hintEl.style.display = "block";
    hintEl.innerHTML = 'Otevřete <a href="welcome.html" target="_blank" rel="noopener" style="color:#d4a843;">nastavení</a> a zadejte doménu eRec.';
    return;
  }

  // Set eRec link from config
  const erecLink = document.getElementById("erec-link");
  if (erecLink) erecLink.href = config.WEB_URL;

  try {
    const cookie = await chrome.cookies.get({
      url: config.WEB_URL,
      name: "erec_token",
    });

    if (cookie && cookie.value) {
      statusEl.className = "status status-ok";
      statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Přihlášen do PPF eRec</span>';
    } else {
      showNotLoggedIn();
    }
  } catch (e) {
    showNotLoggedIn();
  }

  function showNotLoggedIn() {
    statusEl.className = "status status-err";
    statusEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Nepřihlášen</span>';
    hintEl.style.display = "block";
  }

  // Show version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById("version").textContent = `v${manifest.version}`;
})();
