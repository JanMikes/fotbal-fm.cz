import path from 'path';
import { NextResponse } from 'next/server';
import { verifyFormToken } from '@/lib/form-token';
import { sendEmail } from '@/lib/email';
import { getRedisClient } from '@fotbal-fm/cache';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_WINDOW = 600; // 10 minutes
const RATE_LIMIT_MAX = 5; // max submissions per window

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr',
  '.js', '.vbs', '.wsf', '.jar', '.py', '.rb', '.php',
]);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return true; // allow if Redis is unavailable

  const key = `form-rate:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }
  return count <= RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Příliš mnoho odeslaných formulářů. Zkuste to prosím později.' },
        { status: 429 },
      );
    }

    const formData = await request.formData();

    const token = formData.get('_token') as string | null;
    const formName = formData.get('_formName') as string | null;

    if (!token || !formName) {
      return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
    }

    const recipients = verifyFormToken(token);
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Neplatný formulář.' }, { status: 400 });
    }

    // Collect form fields (skip internal fields)
    const fields: { name: string; value: string }[] = [];
    const attachments: { filename: string; content: Buffer }[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('_')) continue;

      if (value instanceof File && value.size > 0) {
        if (value.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `Soubor "${escapeHtml(value.name)}" je příliš velký (max 10 MB).` },
            { status: 400 },
          );
        }

        const ext = path.extname(value.name).toLowerCase();
        if (BLOCKED_EXTENSIONS.has(ext)) {
          return NextResponse.json(
            { error: `Typ souboru "${ext}" není povolen.` },
            { status: 400 },
          );
        }

        const buffer = Buffer.from(await value.arrayBuffer());
        attachments.push({ filename: path.basename(value.name), content: buffer });
      } else if (typeof value === 'string') {
        fields.push({ name: key, value });
      }
    }

    if (fields.length === 0 && attachments.length === 0) {
      return NextResponse.json({ error: 'Formulář je prázdný.' }, { status: 400 });
    }

    const html = buildEmailHtml(formName, fields, attachments.length);
    const success = await sendEmail({
      to: recipients,
      subject: `Nový formulář: ${formName}`,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Odeslání e-mailu se nezdařilo. Zkuste to prosím později.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Form Submit] Error:', error);
    return NextResponse.json(
      { error: 'Nastala neočekávaná chyba.' },
      { status: 500 },
    );
  }
}

function buildEmailHtml(formName: string, fields: { name: string; value: string }[], attachmentCount: number): string {
  const rows = fields
    .map(
      (f) =>
        `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; white-space: nowrap; vertical-align: top;">${escapeHtml(f.name)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${escapeHtml(f.value).replace(/\n/g, '<br>')}</td>
        </tr>`,
    )
    .join('');

  const attachmentNote = attachmentCount > 0
    ? `<p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Přílohy: ${attachmentCount} soubor${attachmentCount > 1 ? 'y' : ''}</p>`
    : '';

  return `
    <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #1e40af; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${escapeHtml(formName)}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Odesláno: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</p>
      </div>
      <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${rows}
        </table>
        ${attachmentNote}
      </div>
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">Fotbal FM - automatická notifikace</p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
