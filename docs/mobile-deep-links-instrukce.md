---
title: "Fotbal F-M – mobilní aplikace: deep linky a skupiny uživatelů"
subtitle: "Zadání pro tým mobilní aplikace (.NET MAUI) · verze 1 · září 2026"
lang: cs
---

# Shrnutí

Web a API klubu nově umí:

1. **Skupiny uživatelů** (*audience categories*) – pojmenované skupiny, do kterých uživatel patří (N:M). Uživatel si je vidí a mění v aplikaci. Později podle nich budeme cílit push notifikace.
2. **Deep linky** `https://fotbal-fm.cz/a/<KÓD>` – odkaz, který po registraci nebo přihlášení přidá uživateli skupiny nastavené u odkazu. Odkazy vytváří klub ve Strapi a nově je umí vytvořit i uživatel v aplikaci („Pozvat přítele“).

Na straně aplikace je potřeba:

| Oblast | Co udělat |
|---|---|
| Associated domains | Přidat `fotbal-fm.cz` a `www.fotbal-fm.cz` (Universal Links / App Links pro cestu `/a/*`). Soubory `.well-known` už web servíruje. |
| Zpracování odkazu | Rozšířit `HandleAppDeeplink` o `https://fotbal-fm.cz/a/<KÓD>` a `fkfm://a/<KÓD>`. |
| Odložený deep link | Android: Play Install Referrer. iOS: kontrola schránky při prvním spuštění. Obojí + ruční zadání kódu. |
| Registrace / přihlášení | Posílat volitelné pole `deepLinkCode`; číst nová pole odpovědi `user.audienceCategories` a `deepLink`. |
| Nastavení | Obrazovka „Moje skupiny“ (výběr + uložení). |
| Pozvat přítele | Tlačítko, které zavolá `POST /deep-links` a otevře sdílení s vráceným `url`. |
| OneSignal (doporučení) | Po přihlášení `OneSignal.Login(<id uživatele>)`, při odhlášení `Logout()`. |

Všechny změny API jsou **zpětně kompatibilní** – nová pole v odpovědích jen přibyla, nové parametry požadavků jsou volitelné. Stávající verze aplikace fungují dál.

# API

Základní URL: `https://api.fotbal-fm.thedevs.cz/api/v1` (stejné jako dosud). Až se API přesune na `https://api.fotbal-fm.cz`, stačí přepnout `ActiveUrl` v `ApiConfiguration.cs` – nespoléhejte na přesměrování, .NET `HttpClient` při přesměrování na jiný host zahazuje hlavičku `Authorization`. Swagger: `/docs`.

Autorizace: `Authorization: Bearer <jwt>` z přihlášení/registrace (beze změny).

Volitelná hlavička u všech nových volání: `X-App-Platform: ios` nebo `android` – používá se jen pro statistiku, kdo přišel přes který odkaz.

## Skupiny uživatele

### `GET /audience-categories` (bez přihlášení)

Skupiny, které si uživatel může sám zvolit, seřazené pro zobrazení.

```json
{ "data": [
  { "documentId": "…", "slug": "rodice-u12", "name": "Rodiče U12", "description": "Rodiče hráčů U12", "sortOrder": 1, "selectable": true },
  { "documentId": "…", "slug": "fanousci", "name": "Fanoušci", "description": null, "sortOrder": 2, "selectable": true }
] }
```

### `GET /me/audience-categories` (JWT)

Skupiny přihlášeného uživatele. Mohou obsahovat i skupiny se `selectable: false` – ty uživatel nemůže sám přidat (dostal je odkazem nebo od klubu), ale může je odebrat.

### `PUT /me/audience-categories` (JWT)

Nahradí seznam skupin uživatele. Tělo = kompletní nový seznam slugů:

```json
{ "audienceCategories": ["rodice-u12", "fanousci"] }
```

Odpověď `200` má stejný tvar jako `GET`. Chyby `400` s textem pro uživatele v `error`:

- neznámý slug – `{ "error": "Neznámá skupina: xyz" }`
- skupina, kterou nelze zvolit a uživatel ji nemá – `{ "error": "Skupinu nelze zvolit: partneri" }`

Pravidla pro obrazovku nastavení: zobrazit sjednocení `GET /audience-categories` a `GET /me/audience-categories`. Položky se `selectable: false` zobrazit jen tehdy, když je uživatel má, a dovolit je pouze odškrtnout. Po uložení poslat celý zaškrtnutý seznam.

## Deep linky

### `GET /deep-links/{code}` (bez přihlášení)

Ověří kód a vrátí, co odkaz přiděluje. Kód není citlivý na velikost písmen, pomlčky a mezery se ignorují (`7k3m-9pq2` = `7K3M9PQ2`).

```json
{ "data": {
  "code": "7K3M9PQ2",
  "url": "https://fotbal-fm.cz/a/7K3M9PQ2",
  "name": "Rodiče U12 – podzim 2026",
  "active": true,
  "expiresAt": null,
  "audienceCategories": [ { "slug": "rodice-u12", "name": "Rodiče U12", … } ]
} }
```

`404` s důvodem: `{ "error": "Odkaz neexistuje.", "reason": "not_found" }`; `reason` může být také `inactive` nebo `expired`. Text v `error` je určený k zobrazení uživateli.

### `POST /deep-links/{code}/claim` (JWT)

Přidá skupiny z odkazu přihlášenému uživateli. Ostatní skupiny uživatele zůstávají. Volání je idempotentní: druhý claim stejného odkazu stejným uživatelem nic nemění (`alreadyClaimed: true`) – nevrací ani skupinu, kterou si uživatel mezitím sám odebral.

```json
{ "data": {
  "code": "7K3M9PQ2",
  "claimed": true,
  "alreadyClaimed": false,
  "addedAudienceCategories": [ { "slug": "rodice-u12", "name": "Rodiče U12", … } ],
  "audienceCategories": [ … ]
} }
```

Chyby: `401` (chybí/expirovaný JWT), `404` (jako u `GET`, včetně `reason`), `429` (příliš mnoho pokusů – zobrazit „zkuste to později“).

### `POST /deep-links` (JWT) – „Pozvat přítele“

Vytvoří odkaz vlastněný přihlášeným uživatelem. Tělo je volitelné:

```json
{ "audienceCategories": ["rodice-u12"], "name": "Pozvánka pro Petra" }
```

- bez těla (nebo `{}`) = odkaz nese aktuální skupiny uživatele, které lze zvolit (`selectable: true`);
- `audienceCategories` = jiný výběr; povolené jsou jen skupiny se `selectable: true`, jinak `400`;
- `name` je jen popisek pro administraci (výchozí `Pozvánka od <username>`).

Odpověď má stejný tvar jako `GET /deep-links/{code}`. Opakované volání se stejným výběrem vrací **stejný** odkaz (nevzniká nový kód) – tlačítko lze klidně mačkat opakovaně. Sdílejte `data.url`. Limit 20 vytvoření za hodinu (`429`).

## Registrace a přihlášení

`POST /auth/register` a `POST /auth/login` přijímají nové **volitelné** pole `deepLinkCode`:

```json
{ "username": "jana", "email": "jana@example.com", "password": "…", "deepLinkCode": "7K3M9PQ2" }
```

Při úspěchu server kód uplatní sám (aplikace už nemusí volat `claim`). Odpověď je stejná jako dosud (`jwt`, `user` se všemi dosavadními poli) plus:

```json
{
  "jwt": "…",
  "user": { "id": 40, "username": "jana", "email": "…", "confirmed": true, "createdAt": "…",
            "audienceCategories": [ { "slug": "rodice-u12", "name": "Rodiče U12", … } ] },
  "deepLink": {
    "code": "7K3M9PQ2", "claimed": true, "alreadyClaimed": false,
    "addedAudienceCategories": [ … ], "audienceCategories": [ … ]
  }
}
```

Neplatný kód registraci ani přihlášení **nezablokuje**: přijde `200` a `deepLink.claimed: false` s `reason` (`not_found`, `inactive`, `expired`, `rate_limited`, `error`). Pole `deepLinkCode` smí být i `null` nebo prázdný řetězec – bere se jako „bez kódu“. `user.audienceCategories` přichází vždy, i bez kódu.

# Deep link v aplikaci

## Formát

- Webový odkaz: `https://fotbal-fm.cz/a/<KÓD>` (i `www.fotbal-fm.cz`). Kód: 4–16 znaků `A–Z`, `0–9`; generované kódy mají 8 znaků a neobsahují `I`, `L`, `O`, `U`. Server toleruje malá písmena, pomlčky a mezery.
- Vlastní schéma: `fkfm://a/<KÓD>` – používá ho web jako tlačítko „Mám aplikaci – otevřít“ na iOS a Android intent (`intent://a/<KÓD>#Intent;scheme=fkfm;package=com.wantoo.fkfm;…`).
- Kód z URL: poslední segment cesty za `/a/`; před použitím `Trim().ToUpperInvariant()` a odstranit `-` a mezery.

## iOS – Universal Links

1. `Entitlements.plist` (i `Entitlements.Release.plist`): do `com.apple.developer.associated-domains` přidat `applinks:fotbal-fm.cz` a `applinks:www.fotbal-fm.cz`. Stávající `applinks:api.fotbal-fm.cz` a `webcredentials:api.fotbal-fm.cz` patří ke starému backendu, který se už nepoužívá – můžete je odstranit.
2. Soubor `https://fotbal-fm.cz/.well-known/apple-app-site-association` už web vrací (`application/json`), s `appIDs: ["9C729Z8P28.com.wantoo.fkfm"]` a `components: [{ "/": "/a/*" }]`. Apple CDN si ho stáhne při instalaci aplikace; ověřit lze na `https://app-site-association.cdn-apple.com/a/v1/fotbal-fm.cz`.
3. `AppDelegate.ContinueUserActivity` už volá `App.HandleAppDeeplink(uri)` – stačí v `HandleAppDeeplink` obsloužit `uri.Host` = `fotbal-fm.cz` / `www.fotbal-fm.cz` a cestu začínající `/a/`.
4. `AppDelegate.OpenUrl` obsluhuje schéma `fkfm://` – přidat větev pro `fkfm://a/<KÓD>` (`uri.Host == "a"`).
5. Volitelně: v `Info.plist` není nic potřeba měnit; Smart App Banner na landing stránce předává `app-argument` = URL odkazu, což opět dorazí přes `ContinueUserActivity`.

## Android – App Links

1. `AndroidManifest.xml`: **nový, samostatný** `intent-filter` s `android:autoVerify="true"` pro `https` a hosty `fotbal-fm.cz` a `www.fotbal-fm.cz`, `android:pathPrefix="/a/"`. Samostatný proto, že ověření celého filtru selže, pokud kterýkoli host neověří. Stávající filtr pro `api.fotbal-fm.cz` (`/t/`, `/i/`) patří ke starému backendu a lze ho odstranit.
2. `https://fotbal-fm.cz/.well-known/assetlinks.json` web vrací s balíčkem `com.wantoo.fkfm` a oběma otisky certifikátů, které dnes uvádí `api.fotbal-fm.cz`. **Prosíme o kontrolu**, že jde o správné otisky (upload key + Play App Signing). Ověření: `adb shell pm get-app-links com.wantoo.fkfm`.
3. Schéma `fkfm://a/<KÓD>` pokrývá stávající `[IntentFilter(DataScheme = "fkfm")]` na `MainActivity`; `HandleIntent` → `HandleAppDeeplink` – doplnit větev pro host `a`.

## Odložený deep link (aplikace nebyla nainstalovaná)

Landing stránka se zobrazí jen tomu, kdo aplikaci nemá. Kód musí přežít instalaci:

**Android – Play Install Referrer.** Landing stránka posílá na Google Play `…&referrer=deeplink%3D<KÓD>`. Při **prvním** spuštění po instalaci přečíst referrer přes Google Play Install Referrer Library (binding `InstallReferrerClient`): hodnota `installReferrer` je řetězec ve tvaru `deeplink=<KÓD>` (může obsahovat i další parametry oddělené `&`). Přečíst jednou, uložit příznak, spojení ukončit (`EndConnection`).

**iOS – schránka.** Landing stránka po klepnutí na „Stáhnout v App Store“ zkopíruje URL odkazu do schránky a teprve pak otevře App Store. Při **prvním** spuštění po instalaci:

1. `UIPasteboard.General.DetectPatterns(…ProbableWebUrl…)` – zjistí bez systémového dotazu, zda schránka pravděpodobně obsahuje URL;
2. jen pokud ano, přečíst `UIPasteboard.General.Url` / `.String` (systém jednou zobrazí dotaz „Povolit vložení…“);
3. pokud URL míří na `fotbal-fm.cz/a/<KÓD>`, vzít kód a schránku ponechat.

Kontrolu provádět jen při prvním spuštění (příznak v Preferences), aby se dotaz neopakoval.

**Záložní cesty (obě platformy).** Landing stránka uživateli říká: po instalaci klepněte na odkaz znovu (Universal/App Link) nebo zadejte kód v aplikaci. Proto:

- na registrační obrazovce ponechat pole pro kód pozvánky (stávající `InviteCode`),
- v nastavení přidat akci „Mám kód pozvánky“ → `POST /deep-links/{code}/claim`.

## Stavový diagram v aplikaci

1. Kód dorazí (odkaz, referrer, schránka, ruční zadání) → normalizovat a uložit jako `pendingDeepLinkCode` (Preferences). Přepsat případný starší kód.
2. Je platný JWT? → `GET /deep-links/{code}` pro náhled skupin (volitelné) a `POST /deep-links/{code}/claim`. Výsledek zobrazit („Přidali jsme vás do skupin: …“ nebo text z `error`). Pending kód smazat i při `404`.
3. Není přihlášen (host nebo odhlášen) → kód nechat uložený a zobrazit lištu „Máte pozvánku do skupin …, přihlaste se nebo se zaregistrujte“. Na `register`/`login` poslat `deepLinkCode`; z odpovědi přečíst `deepLink` a zobrazit výsledek; pending smazat.
4. `deepLink.claimed == false` → zobrazit zprávu podle `reason`; pending smazat (u `rate_limited` ponechat a zkusit později).
5. `429` → „zkuste to prosím později“; pending ponechat.

Stávající větev `fkfm://register?inviteCode=` (odhlásí uživatele a otevře registraci) pro nové odkazy **nepoužívat** – přihlášený uživatel se odhlašovat nemá.

# Obrazovky

**Moje skupiny** (Nastavení, vedle „Notifikace“): seznam s checkboxy podle pravidel výše, tlačítko Uložit → `PUT /me/audience-categories`, potvrzení, chyba `400` zobrazit text z `error`.

**Pozvat přítele** (např. v Nastavení nebo na profilu): `POST /deep-links` bez těla → `Share.RequestAsync(url)` s krátkým textem. Případně volba skupin před sdílením (`audienceCategories` v těle). Po instalaci a registraci přítele se skupiny přidělí automaticky.

# OneSignal (doporučení, mimo rozsah v1)

Aplikace OneSignal inicializuje, ale neříká mu, kdo je uživatel. Aby šlo později cílit notifikace podle skupin ze serveru bez synchronizace tagů v aplikaci, prosíme doplnit:

- po přihlášení/registraci: `OneSignal.Login(user.Id.ToString())`
- při odhlášení / smazání účtu: `OneSignal.Logout()`

# Testování

- Testovací odkazy vytvoříme ve Strapi a pošleme (kód + URL). Na `GET /deep-links/{code}` si lze kdykoli ověřit, co odkaz přiděluje.
- Universal Links: po instalaci buildu s novými entitlements otevřít odkaz z Poznámek/Zpráv (ne z adresního řádku Safari – tam Apple aplikaci záměrně neotvírá).
- App Links: `adb shell pm verify-app-links --re-verify com.wantoo.fkfm` a `adb shell am start -a android.intent.action.VIEW -d "https://fotbal-fm.cz/a/7K3M9PQ2"`.
- Install Referrer lze testovat přes interní testovací stopu Google Play, nebo lokálně: `adb shell am broadcast -a com.android.vending.INSTALL_REFERRER -n com.wantoo.fkfm/<receiver> --es referrer "deeplink=7K3M9PQ2"` (jen pokud používáte broadcast receiver; knihovna Install Referrer testovací stopu vyžaduje).
- Schránka na iOS: zkopírovat `https://fotbal-fm.cz/a/7K3M9PQ2`, smazat a nainstalovat aplikaci, spustit.

Dotazy a testovací účty: Jan Mikeš.
