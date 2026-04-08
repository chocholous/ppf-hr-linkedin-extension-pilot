# PPF eRec – LinkedIn Matcher

Chrome extension pro recruitery PPF Group. Automaticky propojuje LinkedIn profily s interním recruitmentovým systémem PPF eRec.

## Co extension dělá

Při prohlížení LinkedIn stránek extension:

1. **Přečte jméno** osoby z LinkedIn stránky (z JSON-LD metadat nebo DOM headingů)
2. **Vyhledá kandidáta** v eRec API (obě varianty: Jméno Příjmení i Příjmení Jméno)
3. **Zobrazí výsledek** přímo na LinkedIn stránce

## Podporované LinkedIn stránky

- **Profil** (`linkedin.com/in/...`) — panel s detaily kandidáta pod jménem
- **Vyhledávání** (`linkedin.com/search/...`) — inline badge u každého jména ve výsledcích
- **Recruiter** (`linkedin.com/talent/...`) — inline badge u každého jména

## Jak funguje vyhledávání

- Content script (`content.js`) extrahuje jméno z LinkedIn DOM
- Pošle zprávu do background service workeru
- Background (`background.js`) načte doménu eRec z `chrome.storage.local`
- Přečte `erec_token` cookie z web subdomény
- Zavolá eRec API s Bearer tokenem
- Výsledky deduplikuje a vrátí content scriptu
- Content script vykreslí UI

## Co se zobrazuje

### Na profilu (nalezeno)
- Panel s odkazem na kandidáta v eRec
- Telefon, email, LinkedIn (pokud jsou v eRec)
- Přímý odkaz do eRec profilu kandidáta

### Na profilu (nenalezeno / chyba)
- Malý badge "eRec" vedle jména
- Šedý = nenalezeno, červený = chyba/nepřihlášen, pulzující = načítání

### Ve vyhledávání / Recruiteru
- Inline badge u každého jména
- Ikona odkazu do eRec, telefon (klik = kopírovat), email (klik = otevřít Outlook)
- Expand tlačítko pokud je více kandidátů se stejným jménem

## Indikace stavu přihlášení

- **Ikona extension** — malá tečka v rohu: zelená = přihlášen, červená = nepřihlášen
- **Popup** (klik na ikonu) — stav přihlášení + odkaz na přihlášení do eRec + seznam podporovaných stránek
- Stav se aktualizuje přes `chrome.alarms` (každých 30s), při změně cookies na eRec doméně a při přepnutí tabu

## Konfigurace

- Doména eRec instance se zadává při prvním spuštění (welcome page / setup wizard)
- Uložena v `chrome.storage.local` jako `erecDomain`
- Extension si dynamicky vyžádá `optional_host_permissions` pro `web.` a `api.` subdomény
- Setup wizard ověří přihlášení a konektivitu k API

## Autentizace

- Extension neukládá žádné přihlašovací údaje
- Využívá `erec_token` cookie z web subdomény nakonfigurované eRec instance
- Uživatel se musí přihlásit do eRec v jiném tabu stejného prohlížeče
- Token se používá jako Bearer token v API requestech

## Welcome stránka (Setup wizard)

Při první instalaci se otevře welcome tab s průvodcem:
1. Zadat doménu eRec instance
2. Přihlásit se do eRec
3. Ověřit spojení
4. Připnout extension na toolbar Chrome
5. Otevřít LinkedIn

## Soubory

| Soubor | Účel |
|--------|------|
| `manifest.json` | Manifest V3 — permissions, content scripts, ikony |
| `background.js` | Service worker — API volání, cookie auth, badge stav |
| `content.js` | Injektován na LinkedIn — extrakce jmen, vykreslení UI |
| `content.css` | Styly panelů a badges (navy + gold brand) |
| `popup.html` + `popup.js` | Popup po kliknutí na ikonu — stav přihlášení |
| `welcome.html` | Setup wizard + onboarding stránka po instalaci |
| `icon16/48/128.png` | Ikony extension (PPF favicon) |

## Permissions

| Permission | Důvod |
|-----------|-------|
| `cookies` | Čtení `erec_token` pro autentizaci API |
| `activeTab` | Přístup k aktuálnímu tabu |
| `alarms` | Periodická kontrola stavu přihlášení |
| `storage` | Uložení konfigurace (doména eRec) |
| `optional_host_permissions` | Dynamicky vyžádaný přístup k eRec doméně |
