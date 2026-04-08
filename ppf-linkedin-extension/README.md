# PPF eRec – LinkedIn Matcher

Chrome extension, který na LinkedIn profilu zobrazí odkaz na odpovídajícího kandidáta v PPF Group eRec systému.

## Jak to funguje

1. Při instalaci zadáte doménu vaší eRec instance (setup wizard)
2. Extension přečte jméno z LinkedIn profilu
3. V pozadí vyhledá kandidáta v eRec (obě varianty: jméno+příjmení i příjmení+jméno)
4. Na LinkedIn profilu se zobrazí panel s odkazem na kandidáta

## Předpoklady

- Musíte být **přihlášeni** do eRec v **jiném tabu** stejného prohlížeče
- Extension využívá vaše přihlašovací cookies (žádné heslo se neukládá)
- Doménu eRec instance dostanete od administrátora

## Instalace (developer mode)

1. Otevřete `chrome://extensions/`
2. Zapněte **Developer mode** (pravý horní roh)
3. Klikněte **Load unpacked**
4. Vyberte složku `ppf-linkedin-extension/`
5. Otevře se setup wizard — zadejte doménu eRec, přihlaste se a ověřte spojení

## Architektura

```
manifest.json          – Manifest V3, definuje permissions a skripty
background.js          – Service worker; dělá fetch na eRec API (obchází CORS)
content.js             – Injektován na linkedin.com/in/*; čte jméno, zobrazuje panel
content.css            – Styly panelu
welcome.html           – Setup wizard (konfigurace domény, ověření přihlášení)
popup.html / popup.js  – Popup s přehledem stavu
```

### Tok dat

```
LinkedIn DOM (h1 se jménem)
    → content.js extrahuje jméno
    → chrome.runtime.sendMessage → background.js
    → background.js načte doménu z chrome.storage.local
    → fetchne eRec API s cookies (oba orderings jména)
    → odpověď se pošle zpět → content.js renderuje panel
```

## Konfigurace

Doména eRec instance se ukládá do `chrome.storage.local` při prvním spuštění (welcome page). Extension si dynamicky vyžádá `optional_host_permissions` pro `web.` a `api.` subdomény.

Pro změnu domény otevřete welcome.html (odkaz je v popup okně extension).

## Řešení problémů

| Problém | Řešení |
|---------|--------|
| Panel ukazuje "Nepřihlášen" | Přihlaste se do eRec v jiném tabu, refreshněte LinkedIn |
| Panel ukazuje "Nenastaveno" | Otevřete nastavení (welcome page) a zadejte doménu |
| Panel se nezobrazí | Zkontrolujte, že extension je načtena a povolena na linkedin.com |
| Ověření v setup wizardu selhává | Zkontrolujte, že doména je správná a že jste přihlášeni |
