# Implementace Autentizace se Strapi (SSR)

## Přehled

Implementace kompletního autentizačního systému s použitím Strapi 5 jako backend a Next.js 16 pro SSR frontend.

## Architektura

- **Session management**: iron-session (lightweight, encrypted cookies, SSR-friendly)
- **Validace formulářů**: zod + react-hook-form
- **Vzor API**: Hybridní přístup
  - JWT token v session pro autentizované požadavky uživatelů
  - STRAPI_API_TOKEN pro service-to-service komunikaci (nikdy nesmí uniknout do klienta)
- **Jazyk UI**: Čeština

## Bezpečnostní požadavky

1. **STRAPI_API_TOKEN NIKDY nesmí být dostupný na klientovi**
   - Používá se pouze v server-side kódu
   - Pro service-to-service komunikaci

2. **JWT token** (získaný po přihlášení)
   - Uložen v šifrované session cookie (httpOnly)
   - Používá se pro autentizované požadavky uživatelů

3. **Session cookies**
   - httpOnly: true
   - secure: true (v produkci)
   - sameSite: 'lax'
   - Šifrované pomocí iron-session

## Registrační pole

Formulář pro registraci obsahuje:
- **email** (povinné) - odesílá se do Strapi jako `username` i `email` (username === email)
- **password** (povinné) - minimálně 8 znaků
- **firstName** (povinné) - jméno
- **lastName** (povinné) - příjmení
- **jobTitle** (povinné) - funkce

## Implementační kroky

### ✅ 1. Příprava infrastruktury

- [x] Vytvoření `.features/authentication.md`
- [ ] Instalace závislostí:
  ```bash
  docker compose exec nextjs npm install iron-session zod react-hook-form @hookform/resolvers
  ```
- [ ] Vytvoření `.env.local`:
  ```env
  SESSION_SECRET=<random-32-char-string>
  STRAPI_URL=http://strapi:1337
  STRAPI_API_TOKEN=<from-compose-override>
  ```
- [ ] Definice TypeScript typů

### 2. TypeScript typy

Soubory k vytvoření:
- `nextjs/types/user.ts` - User interface
- `nextjs/types/session.ts` - SessionData interface
- `nextjs/types/api.ts` - API request/response typy

```typescript
// Příklad User type
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  confirmed: boolean;
  blocked: boolean;
}

// Session data
interface SessionData {
  userId: number;
  email: string;
  jwt: string;
  isLoggedIn: boolean;
}
```

### 3. Session management

Soubor: `nextjs/lib/session.ts`

Funkce k implementaci:
- `getSessionConfig()` - konfigurace iron-session
- `getSession(req, res)` - získání session
- `createSession(sessionData)` - vytvoření session
- `destroySession()` - smazání session

### 4. Strapi API klient

Soubor: `nextjs/lib/strapi.ts`

Funkce k implementaci:
- `strapiLogin(email, password)` - volání POST /api/auth/local
- `strapiRegister(userData)` - volání POST /api/auth/local/register
- `strapiGetMe(jwt)` - volání GET /api/users/me
- `strapiUpdateProfile(jwt, userId, data)` - volání PUT /api/users/:id
- `strapiChangePassword(jwt, currentPassword, newPassword)` - volání POST /api/auth/change-password

**DŮLEŽITÉ**: Všechny funkce musí běžet pouze na serveru!

### 5. Validační schémata

Soubor: `nextjs/lib/validation.ts`

Schémata:
- `loginSchema` - email, password
- `registerSchema` - email, password, firstName, lastName, jobTitle
- `updateProfileSchema` - firstName, lastName, jobTitle
- `changePasswordSchema` - currentPassword, newPassword, confirmPassword

```typescript
// Příklad
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Neplatný formát emailu'),
  password: z.string().min(8, 'Heslo musí mít alespoň 8 znaků'),
  firstName: z.string().min(1, 'Jméno je povinné'),
  lastName: z.string().min(1, 'Příjmení je povinné'),
  jobTitle: z.string().min(1, 'Funkce je povinná'),
});
```

### 6. API Routes

Všechny v `nextjs/app/api/auth/`:

#### `login/route.ts`
- `POST /api/auth/login`
- Přijímá: { email, password }
- Volá: `strapiLogin()`
- Vytvoří session s JWT
- Vrací: { user, success }

#### `register/route.ts`
- `POST /api/auth/register`
- Přijímá: { email, password, firstName, lastName, jobTitle }
- **username = email** (Strapi requirement)
- Volá: `strapiRegister()`
- Automaticky přihlásí (vytvoří session)
- Vrací: { user, success }

#### `logout/route.ts`
- `POST /api/auth/logout`
- Smaže session
- Vrací: { success }

#### `me/route.ts`
- `GET /api/auth/me`
- Načte user data ze session
- Volá: `strapiGetMe(jwt)` pro fresh data
- Vrací: { user } nebo 401

#### `update-profile/route.ts`
- `PUT /api/auth/update-profile`
- Přijímá: { firstName, lastName, jobTitle }
- Ověří session
- Volá: `strapiUpdateProfile()`
- Vrací: { user, success }

#### `change-password/route.ts`
- `POST /api/auth/change-password`
- Přijímá: { currentPassword, newPassword }
- Ověří session
- Volá: `strapiChangePassword()`
- Vrací: { success }

### 7. Middleware

Soubor: `nextjs/middleware.ts`

Konfigurace:
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads).*)',
  ],
};
```

Logika:
- **Public routes**: `/`, `/prihlaseni`, `/registrace`
- **Protected routes**: `/dashboard`, `/nastaveni`
- Pokud guest přistupuje na protected → redirect na `/prihlaseni`
- Pokud authenticated přistupuje na `/prihlaseni` nebo `/registrace` → redirect na `/dashboard`

### 8. User Context

Soubory:
- `nextjs/contexts/UserContext.tsx` - React Context provider
- Server action pro načtení user dat

```typescript
interface UserContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```

Hook:
```typescript
export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}
```

### 9. UI Komponenty

#### Základní komponenty (`nextjs/components/ui/`)

- `Input.tsx` - Input field s error handling
- `Button.tsx` - Button component (primary, secondary, danger)
- `FormField.tsx` - Label + Input + Error message wrapper
- `Card.tsx` - Card container pro formuláře

**Styling**: Tailwind CSS 4

#### Form komponenty (`nextjs/components/forms/`)

- `LoginForm.tsx` - Přihlašovací formulář
- `RegisterForm.tsx` - Registrační formulář
- `ProfileForm.tsx` - Editace profilu
- `ChangePasswordForm.tsx` - Změna hesla

### 10. Stránky

#### `/prihlaseni` (`app/prihlaseni/page.tsx`)

- Nadpis: "Přihlášení"
- LoginForm komponenta
- Link na registraci: "Nemáte účet? Zaregistrujte se"
- Po úspěšném přihlášení: redirect na `/dashboard`

#### `/registrace` (`app/registrace/page.tsx`)

- Nadpis: "Registrace"
- RegisterForm komponenta
- Pole: Email, Heslo, Jméno, Příjmení, Funkce
- Link na přihlášení: "Už máte účet? Přihlaste se"
- Po úspěšné registraci: redirect na `/dashboard`

#### `/dashboard` (`app/dashboard/page.tsx`)

- **PROTECTED**
- Nadpis: "Dashboard"
- Zobrazení uživatelských dat
- Link na nastavení
- Obsah: základní info o uživateli

#### `/nastaveni` (`app/nastaveni/page.tsx`)

- **PROTECTED**
- Nadpis: "Nastavení"
- Sekce "Profil":
  - Zobrazení emailu (read-only)
  - ProfileForm (firstName, lastName, jobTitle)
- Sekce "Změna hesla":
  - ChangePasswordForm
  - Pole: Současné heslo, Nové heslo, Potvrzení hesla

### 11. Navigace

Aktualizace `app/layout.tsx`:

- UserProvider wrapper
- Navbar s:
  - Logo / název aplikace
  - Pro nepřihlášené: "Přihlášení" | "Registrace"
  - Pro přihlášené: "Dashboard" | "Nastavení" | User menu (jméno + dropdown s "Odhlásit se")

### 12. Strapi konfigurace

#### CORS (`strapi/config/middlewares.ts`)

```typescript
{
  name: 'strapi::cors',
  config: {
    origin: ['http://localhost:3000', 'http://nextjs:3000'],
    credentials: true,
  },
}
```

#### Permissions (Strapi Admin UI)

**Public role**:
- `auth.local` (login) - ✅
- `auth.local.register` (register) - ✅
- `auth.callback` - ✅

**Authenticated role**:
- `users-permissions.user.me` - ✅
- `users-permissions.user.update` - ✅ (own data only)
- `auth.change-password` - ✅

### 13. Environment Variables

#### `.env.local` (Next.js, gitignored)

```env
# Session
SESSION_SECRET=<generate-random-32-char-string>

# Strapi API
STRAPI_URL=http://strapi:1337
STRAPI_API_TOKEN=838f40d243a68bd735b8ae403b0ee23ac247c0b5209d7695c46637adf5c0f9dc15a84d02c49d56eb9f2bc27843d261d7fbbb89d5d37e0e3cfb6a8784e3f90ffb29ecff4fcd44e34ff02a43deb52a7a2d04ff560e9a9c69dd56af00e68f23d2f9ae00a43b3d42efeb69e6aa87e1ff63d0506f22b83e71e3b5fe287d62ef31a41a
```

**DŮLEŽITÉ**: Zkontrolovat, že `.env.local` je v `.gitignore`!

#### `compose.override.yaml` (Docker)

ODSTRANIT `STRAPI_API_TOKEN` z environment variables (bude v `.env.local`)

### 14. Testování

#### Testovací scénáře

1. **Registrace nového uživatele**
   - [ ] Vyplnit registrační formulář
   - [ ] Odeslat (mělo by přesměrovat na dashboard)
   - [ ] Ověřit, že uživatel existuje ve Strapi
   - [ ] Ověřit, že session cookie je nastavena

2. **Přihlášení**
   - [ ] Vyplnit přihlašovací formulář
   - [ ] Odeslat (mělo by přesměrovat na dashboard)
   - [ ] Ověřit zobrazení uživatelských dat

3. **Protected routes**
   - [ ] Odhlásit se
   - [ ] Zkusit přístup na `/dashboard` (mělo by přesměrovat na `/prihlaseni`)
   - [ ] Zkusit přístup na `/nastaveni` (mělo by přesměrovat na `/prihlaseni`)

4. **Změna profilu**
   - [ ] Přihlásit se
   - [ ] Navigovat na `/nastaveni`
   - [ ] Změnit jméno, příjmení, funkci
   - [ ] Odeslat
   - [ ] Ověřit změny ve Strapi

5. **Změna hesla**
   - [ ] Přihlásit se
   - [ ] Navigovat na `/nastaveni`
   - [ ] Vyplnit formulář změny hesla
   - [ ] Odeslat
   - [ ] Odhlásit se
   - [ ] Zkusit přihlásit s novým heslem

6. **Odhlášení**
   - [ ] Přihlásit se
   - [ ] Kliknout na "Odhlásit se"
   - [ ] Mělo by přesměrovat na `/`
   - [ ] Session cookie by měla být smazána
   - [ ] Pokus o přístup na `/dashboard` by měl přesměrovat na `/prihlaseni`

7. **Error handling**
   - [ ] Registrace s existujícím emailem (měla by zobrazit error)
   - [ ] Přihlášení se špatným heslem (mělo by zobrazit error)
   - [ ] Změna hesla se špatným současným heslem (měla by zobrazit error)
   - [ ] Validační errory (krátké heslo, neplatný email, prázdná pole)

### 15. Bezpečnostní checklist

- [ ] STRAPI_API_TOKEN není nikde v client-side kódu
- [ ] Session cookies jsou httpOnly
- [ ] Session cookies jsou secure (v produkci)
- [ ] JWT je uložen pouze v šifrované session, ne v localStorage/sessionStorage
- [ ] Validace všech vstupů (client i server side)
- [ ] Error messages neodhalují citlivé informace
- [ ] Rate limiting poznámky do dokumentace
- [ ] CORS je nastaven pouze pro povolené origins

### 16. Struktura souborů

```
nextjs/
├── .env.local (nový, gitignored)
├── middleware.ts (nový)
├── app/
│   ├── layout.tsx (aktualizovat - UserProvider)
│   ├── page.tsx (aktualizovat - veřejná homepage)
│   ├── prihlaseni/
│   │   └── page.tsx (nový)
│   ├── registrace/
│   │   └── page.tsx (nový)
│   ├── dashboard/
│   │   └── page.tsx (nový)
│   ├── nastaveni/
│   │   └── page.tsx (nový)
│   └── api/
│       └── auth/
│           ├── login/route.ts (nový)
│           ├── register/route.ts (nový)
│           ├── logout/route.ts (nový)
│           ├── me/route.ts (nový)
│           ├── update-profile/route.ts (nový)
│           └── change-password/route.ts (nový)
├── components/
│   ├── forms/
│   │   ├── LoginForm.tsx (nový)
│   │   ├── RegisterForm.tsx (nový)
│   │   ├── ProfileForm.tsx (nový)
│   │   └── ChangePasswordForm.tsx (nový)
│   ├── ui/
│   │   ├── Input.tsx (nový)
│   │   ├── Button.tsx (nový)
│   │   ├── FormField.tsx (nový)
│   │   └── Card.tsx (nový)
│   └── Navbar.tsx (nový)
├── contexts/
│   └── UserContext.tsx (nový)
├── lib/
│   ├── session.ts (nový)
│   ├── strapi.ts (nový)
│   └── validation.ts (nový)
└── types/
    ├── user.ts (nový)
    ├── session.ts (nový)
    └── api.ts (nový)

strapi/
└── config/
    └── middlewares.ts (aktualizovat - CORS)
```

## Clean Code & Best Practices

1. **Separation of Concerns**
   - API routes = business logic
   - Components = presentation
   - Lib = utilities a helpers
   - Types = TypeScript definitions

2. **Error Handling**
   - Try-catch ve všech API routes
   - Správné HTTP status kódy (401, 400, 500)
   - User-friendly error messages v češtině

3. **TypeScript**
   - Strict mode
   - Žádné `any` typy
   - Všechny interfaces exportované z `/types`

4. **React Best Practices**
   - Server Components kde možno
   - Client Components pouze když nutné ('use client')
   - Proper form handling s react-hook-form
   - Optimistic updates kde vhodné

5. **Security**
   - Input sanitization
   - XSS protection (React má built-in)
   - CSRF protection (SameSite cookies)
   - No secrets in client code

## Poznámky

- Strapi již má extended user schema s `firstname`, `lastname`, `jobTitle`
- Všechny texty v UI budou v češtině
- Session expiry: 7 dní (nastavitelné)
- Password requirements: min 8 znaků (můžeme zpřísnit)

## Status

- [x] Plán vytvořen
- [ ] Implementace zahájena
- [ ] Implementace dokončena
- [ ] Testování proběhlo
- [ ] Ready for production
