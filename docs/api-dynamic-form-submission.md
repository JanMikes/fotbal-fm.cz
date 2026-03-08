# API - Dynamic Form Submission

Dynamic forms are defined in Strapi CMS. Both the web app and the API share the same form processing logic via the `@fotbal-fm/form` package (`packages/form/`).

## Shared Package: `@fotbal-fm/form`

Contains all form-related logic used by both web and API:

- **`createFormToken(recipients, secret)`** / **`verifyFormToken(token, secret)`** — HMAC-SHA256 signed tokens encoding email recipients
- **`processFormData(formData)`** — extracts fields and file attachments from `FormData`, validates file size (10 MB max) and blocked extensions
- **`buildEmailHtml(formName, fields, attachmentCount)`** — generates styled HTML email body
- **`sendEmail(smtpConfig, options)`** — sends email via nodemailer
- **`FormValidationError`** — thrown by `processFormData` on validation failures

## Endpoints

### GET /api/v1/forms

Returns all available forms with their field definitions and a submission token.

```bash
curl http://localhost:4000/api/v1/forms
```

Response:

```json
{
  "data": [
    {
      "token": "eyJyIjpbInRlc3RA...",
      "form": {
        "documentId": "wlk5vzb0y54pd8sgv028i7f1",
        "name": "Kontaktni formular",
        "submitButtonText": "Odeslat",
        "successMessage": "Formulář byl úspěšně odeslán. Děkujeme!",
        "inputGroups": [
          {
            "title": "Osobní údaje",
            "inputs": [
              {
                "name": "jmeno",
                "label": "Jméno",
                "type": "text",
                "placeholder": null,
                "required": true,
                "helpText": null,
                "options": null,
                "width": "half"
              },
              {
                "name": "pozice",
                "label": "Pozice",
                "type": "select",
                "placeholder": null,
                "required": false,
                "helpText": null,
                "options": ["brankář", "obránce", "záložník", "útočník"],
                "width": "full"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**Input types:** `text`, `email`, `tel`, `number`, `textarea`, `select`, `checkbox`, `radio`, `file`

- `options` — pre-parsed array for `select` and `radio` types, `null` for others
- `width` — layout hint: `"full"` or `"half"`

### POST /api/v1/forms/submit

Submit form data as `multipart/form-data`. Supports text fields and file uploads.

**Reserved fields (prefixed with `_`):**

| Field      | Type   | Required | Description                                   |
|------------|--------|----------|-----------------------------------------------|
| `_token`   | string | yes      | Token from `GET /forms` response              |
| `_formName`| string | yes      | Form name (use `form.name` from GET response) |

All other fields are treated as form data — strings become email body rows, files become email attachments.

#### Example: text fields only

```bash
curl -X POST http://localhost:4000/api/v1/forms/submit \
  -F '_token=eyJyIjpbInRlc3RA...' \
  -F '_formName=Kontaktni formular' \
  -F 'jmeno=Jan Novák' \
  -F 'email=jan@example.com' \
  -F 'zprava=Text zprávy'
```

#### Example: with file attachment

```bash
curl -X POST http://localhost:4000/api/v1/forms/submit \
  -F '_token=eyJyIjpbInRlc3RA...' \
  -F '_formName=Kontaktni formular' \
  -F 'jmeno=Jan Novák' \
  -F 'priloha=@/path/to/document.pdf'
```

#### File constraints

- Max size: **10 MB** per file
- Blocked extensions: `.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`, `.msi`, `.com`, `.scr`, `.js`, `.vbs`, `.wsf`, `.jar`, `.py`, `.rb`, `.php`

**Success response (200):**

```json
{ "data": { "ok": true } }
```

**Error responses:**

| Status | Body                                                | Cause                        |
|--------|-----------------------------------------------------|------------------------------|
| 400    | `{ "error": "Neplatný požadavek. Chybí _token..." }`| Missing `_token` or `_formName` |
| 400    | `{ "error": "Neplatný token." }`                    | Invalid or tampered token    |
| 400    | `{ "error": "Formulář je prázdný." }`               | No fields or files           |
| 400    | `{ "error": "Soubor \"x\" je příliš velký..." }`    | File exceeds 10 MB           |
| 400    | `{ "error": "Typ souboru \".exe\" není povolen." }` | Blocked file extension       |
| 429    | `{ "error": "Příliš mnoho..." }`                    | Rate limit (5 per 10min/IP)  |
| 500    | `{ "error": "Odeslání e-mailu..." }`                | SMTP failure                 |

## Mobile App Integration Flow

```
1. GET /api/v1/forms
   → get form definitions + tokens

2. Render form UI from inputGroups/inputs
   → use type, required, options, width for building widgets

3. User fills out & submits

4. POST /api/v1/forms/submit (multipart/form-data)
   → send _token, _formName, and all field values (use input.name as key)

5. On 200 → show form.successMessage
   On error → show error message from response
```

## Security

The `token` contains HMAC-signed email recipients. The client cannot modify who receives the submission — recipients are configured in Strapi by placing forms on pages with recipient components.

## Rate Limiting

- **API**: In-memory, 5 submissions per 10 minutes per IP (resets on restart)
- **Web**: Redis-based, 5 submissions per 10 minutes per IP (persistent)
