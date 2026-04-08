const domainInput = document.getElementById("domain-input");
const saveBtn = document.getElementById("save-btn");
const domainMsg = document.getElementById("domain-msg");
const erecLink = document.getElementById("erec-link");
const checkBtn = document.getElementById("check-btn");
const loginMsg = document.getElementById("login-msg");

const steps = {
  domain: document.getElementById("step-domain"),
  login: document.getElementById("step-login"),
  pin: document.getElementById("step-pin"),
  done: document.getElementById("step-done"),
};
const nums = {
  domain: document.getElementById("num-domain"),
  login: document.getElementById("num-login"),
  pin: document.getElementById("num-pin"),
  done: document.getElementById("num-done"),
};

let savedDomain = null;

function showSuccess() {
  // Create success overlay
  const overlay = document.createElement("div");
  overlay.className = "success-overlay";
  overlay.innerHTML =
    '<div class="success-card">' +
      '<div class="success-icon">&#10003;</div>' +
      '<div class="success-title">V\u0161e je p\u0159ipraveno!</div>' +
      '<div class="success-text">Extension je nakonfigurovan\u00e1 a p\u0159ipojen\u00e1 k eRec.<br>Otev\u0159ete LinkedIn a vyzkou\u0161ejte ji.</div>' +
      '<a href="https://www.linkedin.com/search/results/people/" target="_blank" rel="noopener" class="success-btn">Otev\u0159\u00edt LinkedIn</a>' +
    '</div>';
  document.body.appendChild(overlay);
  // Animate in
  requestAnimationFrame(() => { overlay.classList.add("visible"); });
  // Dismiss on click outside
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 300);
    }
  });
}

function markDone(stepName) {
  steps[stepName].classList.add("done");
  steps[stepName].classList.remove("disabled");
  nums[stepName].textContent = "✓";
}
function enable(stepName) {
  steps[stepName].classList.remove("disabled");
}

// --- Step 1: Save domain ---

saveBtn.addEventListener("click", async () => {
  const domain = domainInput.value.trim().toLowerCase();
  domainMsg.textContent = "";
  domainMsg.className = "msg";

  if (!domain || !domain.includes(".")) {
    domainMsg.textContent = "Zadejte platnou doménu";
    domainMsg.className = "msg err";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Ukládám…";

  try {
    // Request host permissions for the eRec domain
    const granted = await chrome.permissions.request({
      origins: ["https://web." + domain + "/*", "https://api." + domain + "/*"],
    });

    if (!granted) {
      domainMsg.textContent = "Přístup k doméně nebyl povolen.";
      domainMsg.className = "msg err";
      saveBtn.disabled = false;
      saveBtn.textContent = "Uložit";
      return;
    }

    // Save domain
    await chrome.storage.local.set({ erecDomain: domain });
    savedDomain = domain;
    erecLink.href = "https://web." + domain;
    domainMsg.textContent = "✓ Uloženo — web." + domain;
    domainMsg.className = "msg ok";
    markDone("domain");
    enable("login");

    // Auto-check login right away
    saveBtn.textContent = "Ověřuji přihlášení…";
    var loggedIn = await tryVerifyLogin(domain);
    if (loggedIn) {
      markDone("login");
      enable("pin");
      enable("done");
      chrome.runtime.sendMessage({ action: "updateBadge" });
      showSuccess();
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Uložit";
  } catch (e) {
    domainMsg.textContent = "Chyba: " + e.message;
    domainMsg.className = "msg err";
    saveBtn.disabled = false;
    saveBtn.textContent = "Uložit";
  }
});

// --- Login verification (shared) ---

async function tryVerifyLogin(domain) {
  try {
    var cookie = await chrome.cookies.get({
      url: "https://web." + domain,
      name: "erec_token",
    });
    if (!cookie || !cookie.value) return false;

    var token = decodeURIComponent(cookie.value);
    var apiUrl = "https://api." + domain + "/api/v1/grids/candidates?perPage=1&firstname=test&lastname=test";
    var res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// --- Step 2: Check login ---

checkBtn.addEventListener("click", async () => {
  if (!savedDomain) return;

  loginMsg.textContent = "";
  loginMsg.className = "msg";
  checkBtn.disabled = true;
  checkBtn.textContent = "Ověřuji…";

  var ok = await tryVerifyLogin(savedDomain);

  if (ok) {
    loginMsg.textContent = "✓ Přihlášení ověřeno — spojení s eRec funguje";
    loginMsg.className = "msg ok";
    markDone("login");
    enable("pin");
    enable("done");
    chrome.runtime.sendMessage({ action: "updateBadge" });
    showSuccess();
  } else {
    // Try to give a more specific error
    try {
      var cookie = await chrome.cookies.get({
        url: "https://web." + savedDomain,
        name: "erec_token",
      });
      if (!cookie || !cookie.value) {
        loginMsg.textContent = "Cookie nenalezena — přihlaste se do eRec v jiném tabu a zkuste znovu.";
      } else {
        loginMsg.textContent = "Přihlášení selhalo — zkontrolujte doménu nebo se přihlaste znovu.";
      }
    } catch (e) {
      loginMsg.textContent = "Chyba spojení: " + e.message;
    }
    loginMsg.className = "msg err";
  }

  checkBtn.disabled = false;
  checkBtn.textContent = "Ověřit přihlášení";
});

// --- Restore state if already configured ---

chrome.storage.local.get("erecDomain", async ({ erecDomain }) => {
  if (!erecDomain) return;

  savedDomain = erecDomain;
  domainInput.value = erecDomain;
  erecLink.href = "https://web." + erecDomain;
  domainMsg.textContent = "✓ Uloženo — web." + erecDomain;
  domainMsg.className = "msg ok";
  markDone("domain");
  enable("login");

  try {
    const cookie = await chrome.cookies.get({
      url: "https://web." + erecDomain,
      name: "erec_token",
    });
    if (cookie && cookie.value) {
      loginMsg.textContent = "✓ Přihlášení detekováno — klikněte na Ověřit pro plný test";
      loginMsg.className = "msg info";
    }
  } catch (e) { /* ignore */ }
});
