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
    saveBtn.disabled = false;
    saveBtn.textContent = "Uložit";
    markDone("domain");
    enable("login");
  } catch (e) {
    domainMsg.textContent = "Chyba: " + e.message;
    domainMsg.className = "msg err";
    saveBtn.disabled = false;
    saveBtn.textContent = "Uložit";
  }
});

// --- Step 2: Check login ---

checkBtn.addEventListener("click", async () => {
  if (!savedDomain) return;

  loginMsg.textContent = "";
  loginMsg.className = "msg";
  checkBtn.disabled = true;
  checkBtn.textContent = "Ověřuji…";

  try {
    const cookie = await chrome.cookies.get({
      url: "https://web." + savedDomain,
      name: "erec_token",
    });

    if (cookie && cookie.value) {
      const token = decodeURIComponent(cookie.value);
      const apiUrl = "https://api." + savedDomain + "/api/v1/grids/candidates?perPage=1&firstname=test&lastname=test";

      const res = await fetch(apiUrl, {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + token,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (res.ok) {
        loginMsg.textContent = "✓ Přihlášení ověřeno — spojení s eRec funguje";
        loginMsg.className = "msg ok";
        markDone("login");
        enable("pin");
        enable("done");
      } else if (res.status === 401 || res.status === 403) {
        loginMsg.textContent = "Token vypršel nebo je neplatný. Přihlaste se znovu do eRec a zkuste to znovu.";
        loginMsg.className = "msg err";
      } else {
        loginMsg.textContent = "API vrátilo chybu " + res.status + ". Zkontrolujte, že doména je správná.";
        loginMsg.className = "msg err";
      }
    } else {
      loginMsg.textContent = "Cookie nenalezena — přihlaste se do eRec v jiném tabu a zkuste znovu.";
      loginMsg.className = "msg err";
    }
  } catch (e) {
    loginMsg.textContent = "Chyba spojení: " + e.message + " — zkontrolujte, že doména je správná.";
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
