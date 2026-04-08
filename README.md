# PPF eRec – LinkedIn Matcher

Chrome extension, který na LinkedIn profilu zobrazí odkaz na odpovídajícího kandidáta v PPF Group eRec systému.

Detailní dokumentace je v [`ppf-linkedin-extension/README.md`](ppf-linkedin-extension/README.md).

## Quick start

1. Otevřete `chrome://extensions/`, zapněte **Developer mode**
2. **Load unpacked** → vyberte složku `ppf-linkedin-extension/`
3. Otevře se setup wizard — zadejte doménu eRec, přihlaste se, ověřte spojení
4. Otevřete libovolný LinkedIn profil

## Testy

```bash
npm install
EREC_DOMAIN=your-erec-domain.com npx playwright test
```

Testy vyžadují přihlášení do eRec — viz `.playwright-profile/`.
