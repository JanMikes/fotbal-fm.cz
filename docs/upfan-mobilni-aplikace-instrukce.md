---
title: Prodej vstupenek v aplikaci přes Upfan
subtitle: Přehled, stav a co je potřeba udělat v aplikaci
date: 24. 11. 2026
lang: cs
---

> Tento přehled připravil Claude (AI asistent) z dokumentace Upfanu (docs.upfan.io), odpovědí Upfanu a kódu aplikace, webu a API. Popisuje, co potřebuješ na straně aplikace.

# 1. Stav

- **Upfan schválil** jednu aplikaci pro testovací i ostré nákupy a naše návratové adresy. Testovací přístupy máme.
- **Naše API je naprogramované a otestované:** výpis prodeje, nákup, stav nákupu, zrušení a moje vstupenky (sekce 6). Proti testovacímu prostředí Upfanu jsme ověřili výpis prodeje a založení nákupu až po ověřovací stránku. **Na produkční API ho nasadíme v nejbližších dnech, dáme vědět.** Do té doby můžeš stavět podle sekce 6.
- **Web:** návratové stránky `fotbal-fm.cz/upfan/…` a iOS soubor pro Universal Links jsou hotové a nasadíme je spolu s API.
- **V aplikaci zbývá:** Android odkazy (sekce 5), obrazovka prodeje, průběh nákupu a „Moje vstupenky“ (sekce 7).
- V testovacím prostředí je teď jedna akce: **Permanentky FK Frýdek-Místek 2026/2027** (1 500 Kč / 750 Kč). Upfan prodává obecně „akce“: permanentky i jednotlivé zápasy, bez výběru konkrétních míst.

# 2. Jak nákup funguje

Aplikace mluví **jen s naším API**, nikdy přímo s Upfanem.

1. **Prodej:** `GET /tickets/shop` → akce a kategorie s cenami. Uživatel vybere akci, kategorii a počet (1–10).
2. **Start:** `POST /ticket-purchases` → nákup ve stavu `buyer_verification` a v `nextAction.url` adresa **ověřovací stránky Upfanu**. Aplikace si uloží `reference` a stránku otevře v systémovém prohlížeči.
3. **Ověření u Upfanu:** zákazník zadá e-mail, potvrdí kód z e-mailu a doplní údaje. Upfan ho pak pošle na `https://fotbal-fm.cz/upfan/buyer-return?upfan_onboarding=success`, což otevře aplikaci.
4. **Pokračování:** aplikace zavolá `POST /ticket-purchases/{reference}/resume`. API ověří zákazníka u Upfanu, **zarezervuje vstupenky (15 minut)** a založí objednávku. Vrátí stav `payment` a v `nextAction.url` **platební stránku**. Aplikace ji otevře v prohlížeči.
5. **Platba:** po zaplacení Upfan pošle zákazníka na `https://fotbal-fm.cz/upfan/payment-return?order_reference=…`, což otevře aplikaci.
6. **Výsledek:** aplikace volá `GET /ticket-purchases/{reference}` každých `pollAfterMs`, dokud stav není `success` / `failure`. Platba se může potvrzovat i několik sekund.
7. **Vstupenky:** `GET /me/tickets` → vstupenky s obsahem QR kódu.

**Návrat do aplikace nic nepotvrzuje.** Parametry v adrese (`upfan_onboarding`, `order_reference`) jsou jen signál „zeptej se API“. Rozhoduje vždy odpověď našeho API.

**Ověřování e-mailu:** zatím Upfan ověřuje e-mail **při každém nákupu** (u nás nejsou e-maily účtů ověřené). Pokud se s Upfanem domluvíme jinak, druhý a další nákup přeskočí krok 3: `POST /ticket-purchases` rovnou vrátí stav `payment` s platební stránkou. **Aplikace s tím musí počítat**, tj. vždy se řídit `status` a `nextAction`, ne pevným pořadím kroků.

Nakupovat může jen **přihlášený** uživatel (host vidí výzvu k přihlášení).

# 3. Stavy nákupu

| `status` | Co ukázat | Akce aplikace |
|---|---|---|
| `buyer_verification` | „Ověř svůj e-mail u Upfanu“ + odpočet `expiresAt` (10 min) | po návratovém odkazu `resume`; tlačítko „Pokračovat“ = `resume` a když je stav pořád `buyer_verification`, otevřít `nextAction.url`; tlačítko „Zrušit“ = `cancel` |
| `payment` | „Čekáme na platbu“ + odpočet `expiresAt` (rezervace 15 min) | po návratu z platby volat `GET` každých `pollAfterMs`, nejdéle ~2 minuty; pak přestat a ukázat tlačítko „Zkontrolovat stav“ (`GET`); tlačítko „Otevřít platbu znovu“ = `nextAction.url` |
| `success` | „Hotovo“ → přejít na vstupenky | `GET /me/tickets`, smazat uložený rozpracovaný nákup |
| `failure` | hláška podle `failureCode` (sekce 8) | smazat uložený nákup, nabídnout nový nákup |
| `expired` | „Čas na dokončení vypršel“ | smazat uložený nákup, nabídnout nový nákup |
| `cancelled` | nic | smazat uložený nákup |

`nextAction` otevírej **jen** po startu, po `resume`, nebo když uživatel klepne na tlačítko. Při běžném dotazování stavu stránku znovu neotvírej.

**`resume` volej jen po návratovém odkazu `buyer-return` nebo po klepnutí uživatele**, nikdy automaticky (např. při návratu aplikace do popředí). U Upfanu může každé volání znamenat nový ověřovací e-mail.

# 4. Návratové adresy

| Prostředí | Po ověření zákazníka | Po platbě |
|---|---|---|
| Ostré | `https://fotbal-fm.cz/upfan/buyer-return` | `https://fotbal-fm.cz/upfan/payment-return` |
| Test | `https://fotbal-fm.cz/upfan/test/buyer-return` | `https://fotbal-fm.cz/upfan/test/payment-return` |

- Obě varianty zpracuj **stejně**. Prostředí si drží náš backend u každého nákupu.
- `buyer-return` → `POST /ticket-purchases/{reference}/resume` pro uložený rozpracovaný nákup.
- `payment-return` → `GET /ticket-purchases/{reference}` a dotazovat se dál podle `pollAfterMs`.
- Když se aplikace odkazem neotevře, načte se na stejné adrese náš web s tlačítkem **„Pokračovat v aplikaci“**. To otevře `fkfm://upfan/<stejná cesta>?<stejné parametry>` (na Androidu přes `intent://`). Zpracuj i tyto adresy.
- Když odkaz přijde za studeného startu, ulož ho a zpracuj po přihlášení a načtení (jako dnes `DeepLinkService.PendingCode`).
- Odkaz bez uloženého rozpracovaného nákupu: zavolej `GET /ticket-purchases` a vezmi nejnovější nedokončený (`buyer_verification` nebo `payment`).

# 5. Odkazy do aplikace

### Android: `Platforms/Android/AndroidManifest.xml` (nové vydání)

Přidat k `MainActivity`, každý host zvlášť, stejně jako u `/a/`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="fotbal-fm.cz"
          android:pathPrefix="/upfan/" />
</intent-filter>
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="www.fotbal-fm.cz"
          android:pathPrefix="/upfan/" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="fkfm" android:host="upfan" />
</intent-filter>
```

**Vydej to prosím co nejdřív**, i když nákup ještě nebude vidět. Nic to nerozbije a lidi budou mít novou verzi v době spuštění prodeje.

### iOS

V entitlementech se nic nemění (`applinks:fotbal-fm.cz` už tam je, schéma `fkfm` je registrované). Cestu `/upfan/*` do `apple-app-site-association` na webu doplňujeme my (součást nasazení).

# 6. Naše API

Základ `/api/v1`, všechna volání s `Authorization: Bearer <JWT>` jako dnes. Přesná schémata najdeš ve Swaggeru našeho API (`/docs`).

| Metoda | Cesta | Účel |
|---|---|---|
| `GET` | `/tickets/shop` | prodej: `{ available, environment, events[] }` |
| `POST` | `/ticket-purchases` | start nákupu `{ eventId, ticketCategoryId, quantity }` → 201 |
| `GET` | `/ticket-purchases` | moje nákupy, nejnovější první |
| `GET` | `/ticket-purchases/{reference}` | aktuální stav (ověřený u Upfanu) |
| `POST` | `/ticket-purchases/{reference}/resume` | po návratu z ověření: ověření → rezervace → objednávka |
| `POST` | `/ticket-purchases/{reference}/cancel` | zrušit nedokončený nákup (409, když už čeká na platbu) |
| `GET` | `/me/tickets` | moje vstupenky |

### `GET /tickets/shop`

- `available: false` → sekci prodeje schovej (prodej pro tento účet není otevřený).
- `environment: "sandbox"` → testovací účet, ukaž odznak **TEST**.
- Akce: `name`, `description` (**HTML**, jako u našich akcí; `descriptionText` = čistý text), `startsAt`/`endsAt` (zobrazit v `timezone`), `venue`, `purchasable`.
- Kategorie: `name`, `unitAmount` (**v haléřích**: `150000` = 1 500 Kč), `currency`, `maxQuantity` (horní mez výběru počtu), `purchasable`, `unavailableReason` (`not_on_sale`, `sold_out`, …). Nekupitelné kategorie ukaž neaktivní.

### Nákup (odpověď `POST`, `GET`, `resume`, `cancel`)

```json
{ "data": {
  "reference": "fkfm-13be8298-6fd3-4b54-84b9-374adcbbeb24",
  "status": "payment",
  "environment": "sandbox",
  "event": { "id": 231, "name": "Permanentky …", "startsAt": "…" },
  "category": { "id": 1839, "name": "Permanentka - Zlevněná" },
  "quantity": 1, "unitAmount": 75000, "totalAmount": 75000, "currency": "CZK",
  "expiresAt": "2026-11-24T18:05:30Z",
  "failureCode": null,
  "nextAction": { "type": "open_url", "url": "https://…" },
  "pollAfterMs": 2000,
  "createdAt": "…"
} }
```

### `GET /me/tickets`

Seznam vstupenek: `id`, `event`, `category`, `holderName`, `status`, `environment` a `qrCode`:

- `qrCode` je **text, který se vykreslí jako QR kód přesně tak, jak je**. Může obsahovat jen číslice, i tak ho drž jako string. QR černý na bílém, s okrajem (Upfan doporučuje error correction **H**). Při zobrazení zvyš jas.
- `qrCode: null` → vstupenka ještě není připravená nebo už neplatí. QR neukazuj.
- **Vstupenky ukládej offline** (na stadionu bývá slabý signál), ale při každém otevření je obnov. **Co v novém seznamu chybí, smaž**, i z offline úložiště (vrácené vstupenky Upfan přestane vracet).
- PDF vstupenek zatím nenabízíme. QR kód stačí a Upfan ho kontroluje u vstupu svými čtečkami.

# 7. Co udělat v aplikaci

- **Sekce prodeje:** seznam akcí → detail s kategoriemi → výběr počtu → „Koupit“ (`POST`).
- **Otevírání stránek Upfanu a platby:** jen systémový prohlížeč, **nikdy WebView**. Ideálně `ASWebAuthenticationSession` (iOS) / Custom Tabs (Android), jinak `Browser.OpenAsync`.
- **Rozpracovaný nákup:** `reference` ulož do `Preferences`, aby přežil ukončení aplikace během placení.
- **Návrat do popředí:** když existuje rozpracovaný nákup, zavolej `GET /ticket-purchases/{reference}` i bez odkazu a ukaž stav. Pokryje to ruční přepnutí zpátky. U `buyer_verification` nech uživatele klepnout na „Pokračovat“ (= `resume`), sám ho nevolej.
- **„Moje vstupenky“:** napojit `TicketsApi` (dnes zástupná implementace) na `GET /me/tickets`.
- **„Skenovat lístek“ odstranit:** vstupenky u vstupu kontroluje obsluha přes systém Upfan.
- **Text k vrácení vstupenek:** vrácení, storno zaplacené objednávky a převod vstupenky řeší klub (kontakt doplníme).

# 8. Chyby a hlášky

**HTTP chyby** (tělo `{ "error": "…", "reason": "…" }`, `error` je česky a dá se rovnou ukázat):

| Kód | Kdy | Co dělat |
|---|---|---|
| 401 | neplatný JWT | přihlásit znovu |
| 404 | cizí nebo neexistující nákup | smazat uložený nákup |
| 409 | `cancel` u nákupu, který čeká na platbu | ukázat `error` |
| 422 | akce / kategorie se nedá koupit, špatný počet | ukázat `error`, obnovit prodej |
| 429 | moc požadavků od uživatele | zkusit za chvíli |
| 503 `busy` | Upfan je vytížený | zkusit znovu po `Retry-After` |
| 503 `unavailable` | prodej pro účet není otevřený | schovat prodej |

**`failureCode`** u stavu `failure` / `expired`:

| `failureCode` | Hláška |
|---|---|
| `sold_out` | Vstupenky v této kategorii jsou vyprodané. |
| `inventory_limit` | Prodej je teď přetížený, zkus to prosím za pár minut. |
| `event_unavailable` | Akce už není v prodeji. |
| `order_rejected` | Objednávku se nepodařilo vytvořit, zkus to prosím znovu. |
| `payment_failed` | Platba neproběhla. Můžeš začít nový nákup. |
| `onboarding_expired` | Ověření nebylo dokončeno včas. Začni prosím znovu. |
| `reservation_expired` | Rezervace vypršela. Začni prosím znovu. |

# 9. Testování

- Tvůj testovací účet (a další, které nám pošleš) označíme v administraci jako **testovací**. Uvidí prodej z testovacího prostředí Upfanu s testovacími platbami a odznakem TEST.
- Ostatní účty prodej neuvidí (`available: false`), dokud Upfan po společném ověření nepředá ostré přístupy.
- Před spuštěním ostrého prodeje uděláme s Upfanem společný test: testovací nákup, návrat do aplikace a načtení QR kódu u vstupu.

# 10. App Store a Google Play

- Vstupenky na akce mimo aplikaci se podle App Store Review Guidelines 3.1.5(a) platí **mimo In-App Purchase**, takže platební brána je v pořádku. Zmiň to v poznámce pro review.
- Aktualizovat údaje o ochraně soukromí v obchodech (nákupy).

# 11. Dotazy na tebe

1. Pošli prosím e-maily účtů, které máme označit jako testovací.
2. Kdy zvládneš vydat Android odkazy (sekce 5)?
3. Zvládneš `ASWebAuthenticationSession` / Custom Tabs?
4. Narazíš-li v API na cokoli nejasného nebo nepohodlného, dej vědět. API je čerstvé a snadno ho upravíme.
