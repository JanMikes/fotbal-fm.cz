# Návod k dokončení konfigurace autentizace

## Co je implementováno

Kompletní autentizační systém byl implementován včetně:

- ✅ Session management s iron-session
- ✅ TypeScript typy pro User, Session, API
- ✅ Strapi API klient (server-side only)
- ✅ API routes (/api/auth/*)
- ✅ Middleware pro route protection
- ✅ User Context a hooks
- ✅ UI komponenty (forms, inputs, buttons)
- ✅ Přihlašovací stránka (/prihlaseni)
- ✅ Registrační stránka (/registrace)
- ✅ Protected dashboard (/dashboard)
- ✅ Nastavení stránka (/nastaveni)
- ✅ Navbar s user menu
- ✅ CORS konfigurace ve Strapi
- ✅ .env.local s SESSION_SECRET

## Co je potřeba dokončit

### 1. Konfigurace Strapi Permissions (DŮLEŽITÉ!)

Aby fungovala registrace s custom poli a aktualizace profilu, je potřeba nastavit oprávnění ve Strapi Admin UI.

**Postup:**

1. Přejděte do Strapi Admin: http://localhost:1337/admin
2. Přihlaste se pomocí admin účtu:
   - Email: `admin@mfkfm.cz`
   - Heslo: `AdminPass123!`

3. V levém menu přejděte na **Settings** → **Users & Permissions Plugin** → **Roles**

4. Klikněte na **Public** roli a nastavte následující oprávnění:

   **Users-permissions:**
   - ✅ `auth.callback` - allow
   - ✅ `auth.connect` - allow
   - ✅ `auth.local` (login) - allow
   - ✅ `auth.local.register` (register) - allow

   **POZOR:** Pro public roli NEpovolujte update ani jiné operace s uživateli!

5. Klikněte na **Authenticated** roli a nastavte následující oprávnění:

   **Users-permissions:**
   - ✅ `user.me` - allow (GET)
   - ✅ `user.update` - allow (PUT) - **DŮLEŽITÉ PRO UPDATE PROFILU**
   - ✅ `auth.change-password` - allow (POST)

6. Uložte změny (tlačítko **Save** v pravém horním rohu)

### 2. Testování autentizačního flow

Po konfiguraci permissions otestujte následující scénáře:

#### Test 1: Registrace nového uživatele
```bash
# Přejděte na: http://localhost:3000/registrace
# Vyplňte formulář:
# - Email: test@example.com
# - Heslo: TestPass123
# - Jméno: Jan
# - Příjmení: Novák
# - Funkce: Vývojář

# Mělo by:
# ✓ Úspěšně zaregistrovat uživatele
# ✓ Automaticky přihlásit
# ✓ Přesměrovat na /dashboard
# ✓ Zobrazit jméno, příjmení a funkci
```

#### Test 2: Přihlášení
```bash
# Odhlaste se (v menu)
# Přejděte na: http://localhost:3000/prihlaseni
# Přihlaste se pomocí vytvořeného účtu

# Mělo by:
# ✓ Úspěšně přihlásit
# ✓ Přesměrovat na /dashboard
# ✓ Zobrazit správná uživatelská data
```

#### Test 3: Protected routes
```bash
# Odhlaste se
# Zkuste přistoupit na: http://localhost:3000/dashboard

# Mělo by:
# ✓ Přesměrovat na /prihlaseni
# ✓ URL obsahuje ?redirect=/dashboard
```

#### Test 4: Aktualizace profilu
```bash
# Přihlaste se
# Přejděte na: http://localhost:3000/nastaveni
# Změňte jméno, příjmení nebo funkci
# Klikněte na "Uložit změny"

# Mělo by:
# ✓ Zobrazit "Profil byl úspěšně aktualizován"
# ✓ Změny se projeví na dashboardu
```

#### Test 5: Změna hesla
```bash
# Přihlaste se
# Přejděte na: http://localhost:3000/nastaveni
# Vyplňte sekci "Změna hesla"
# Klikněte na "Změnit heslo"

# Mělo by:
# ✓ Zobrazit "Heslo bylo úspěšně změněno"
# ✓ Formulář se resetuje
# ✓ Můžete se přihlásit s novým heslem
```

#### Test 6: Logout
```bash
# Přihlaste se
# Klikněte na své jméno v navigaci
# Klikněte na "Odhlásit se"

# Mělo by:
# ✓ Přesměrovat na homepage (/)
# ✓ Navigace zobrazuje "Přihlášení" a "Registrace"
# ✓ Pokus o přístup na /dashboard přesměruje na /prihlaseni
```

### 3. Bezpečnostní kontrola

Ověřte následující bezpečnostní aspekty:

- [ ] STRAPI_API_TOKEN není nikde v client-side kódu
- [ ] Session cookies jsou httpOnly (zkontrolujte v DevTools)
- [ ] JWT je uložen pouze v šifrované session
- [ ] Middleware správně chrání protected routes
- [ ] CORS je nastaven pouze pro localhost:3000 a nextjs:3000
- [ ] .env.local je v .gitignore

### 4. Produkční deployment

Pro produkční nasazení je potřeba změnit následující:

#### Strapi (compose.yaml):
```yaml
APP_KEYS: <vygenerujte-random-string>
API_TOKEN_SALT: <vygenerujte-random-string>
ADMIN_JWT_SECRET: <vygenerujte-random-string>
JWT_SECRET: <vygenerujte-random-string>
TRANSFER_TOKEN_SALT: <vygenerujte-random-string>
```

Vygenerujte pomocí:
```bash
openssl rand -base64 32
```

#### Next.js (.env.local):
```bash
SESSION_SECRET=<vygenerujte-random-string>
STRAPI_URL=https://your-strapi-domain.com
STRAPI_API_TOKEN=<zkopírujte-z-strapi-admin>
```

#### CORS (strapi/config/middlewares.ts):
```typescript
origin: ['https://your-nextjs-domain.com'],
```

## Struktura projektu

```
nextjs/
├── .env.local (gitignored, obsahuje SESSION_SECRET)
├── middleware.ts (route protection)
├── app/
│   ├── layout.tsx (UserProvider + Navbar)
│   ├── page.tsx (homepage)
│   ├── prihlaseni/page.tsx
│   ├── registrace/page.tsx
│   ├── dashboard/page.tsx (protected)
│   ├── nastaveni/page.tsx (protected)
│   └── api/auth/
│       ├── login/route.ts
│       ├── register/route.ts
│       ├── logout/route.ts
│       ├── me/route.ts
│       ├── update-profile/route.ts
│       └── change-password/route.ts
├── components/
│   ├── Navbar.tsx
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── ProfileForm.tsx
│   │   └── ChangePasswordForm.tsx
│   └── ui/
│       ├── Input.tsx
│       ├── Button.tsx
│       ├── FormField.tsx
│       └── Card.tsx
├── contexts/
│   └── UserContext.tsx
├── lib/
│   ├── session.ts (iron-session config)
│   ├── strapi.ts (Strapi API client)
│   └── validation.ts (zod schemas)
└── types/
    ├── user.ts
    ├── session.ts
    └── api.ts

strapi/
└── config/
    └── middlewares.ts (CORS config)
```

## Důležité poznámky

1. **STRAPI_API_TOKEN nesmí být nikdy přístupný na klientovi** - používá se pouze v server-side kódu (API routes, middleware)

2. **JWT token** (vrácený po přihlášení) je uložen v šifrované session cookie a používá se pro autentizované požadavky

3. **Dvoustupňová registrace**:
   - Krok 1: Registrace s username, email, password (public)
   - Krok 2: Aktualizace profilu s firstname, lastname, jobTitle (authenticated)

4. **Password validace**:
   - Minimálně 8 znaků
   - Alespoň jedno velké písmeno
   - Alespoň jedno malé písmeno
   - Alespoň jedna číslice

5. **Session lifetime**: 7 dní (nastavitelné v lib/session.ts)

## Troubleshooting

### Problém: "Forbidden" při registraci
**Řešení:** Zkontrolujte Strapi permissions pro Authenticated roli - musí mít povoleno `user.update`

### Problém: Middleware redirect loop
**Řešení:** Zkontrolujte, že routes v middleware.ts jsou správně nakonfigurovány

### Problém: Session cookie není nastavena
**Řešení:** Zkontrolujte, že SESSION_SECRET je v .env.local a aplikace byla restartována

### Problém: CORS errors
**Řešení:** Zkontrolujte, že CORS v Strapi (config/middlewares.ts) povoluje origin Next.js aplikace

## Kontakty a podpora

Pro otázky nebo problémy kontaktujte administrátora systému.
