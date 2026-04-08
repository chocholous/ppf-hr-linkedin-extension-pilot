# Privacy Policy – PPF eRec – LinkedIn Matcher

**Poslední aktualizace:** 8. 4. 2026

## Účel extension

PPF eRec – LinkedIn Matcher je interní nástroj PPF Group určený pro recruitery. Propojuje LinkedIn profily s interním recruitmentovým systémem PPF eRec.

## Jaká data extension zpracovává

### Data čtená z LinkedIn
- Jméno a příjmení zobrazené na LinkedIn profilu (z DOM stránky)
- Tato data se používají výhradně k vyhledání kandidáta v PPF eRec a nejsou nikam ukládána ani odesílána třetím stranám

### Cookies
- Extension využívá existující přihlašovací cookies pro doménu eRec instance nakonfigurovanou uživatelem
- Cookies slouží k autorizaci požadavků na eRec API
- Extension žádné cookies nevytváří, nemodifikuje ani neukládá

### Konfigurace
- Extension ukládá doménu eRec instance do `chrome.storage.local`
- Tato hodnota je zadána uživatelem při prvním spuštění a slouží výhradně k sestavení URL pro API volání

## Kam data směřují
- Veškerá komunikace probíhá výhradně mezi prohlížečem uživatele a servery eRec instance nakonfigurovanou uživatelem
- Žádná data nejsou odesílána třetím stranám, analytickým službám ani externím serverům

## Ukládání dat
- Extension ukládá pouze doménu eRec instance v `chrome.storage.local`
- Neukládá žádná osobní data, přihlašovací údaje ani data kandidátů

## Oprávnění
- **cookies** — čtení přihlašovacích cookies pro eRec
- **activeTab** — přístup k aktuálnímu LinkedIn tabu pro čtení jména z profilu
- **storage** — uložení konfigurace (doména eRec instance)
- **optional_host_permissions** — dynamicky vyžádaný přístup k eRec doméně (web + API subdomény)

## Kontakt
V případě dotazů ohledně ochrany osobních údajů kontaktujte správce extension v rámci PPF Group.
