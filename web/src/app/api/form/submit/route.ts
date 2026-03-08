import { NextResponse } from 'next/server';
import { processFormData, buildEmailHtml, FormValidationError } from '@fotbal-fm/form';
import { verifyFormToken } from '@/lib/form-token';
import { sendEmail } from '@/lib/email';
import { getRedisClient } from '@fotbal-fm/cache';

const RATE_LIMIT_WINDOW = 600; // 10 minutes
const RATE_LIMIT_MAX = 5; // max submissions per window

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

    const { fields, attachments } = await processFormData(formData);

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
    if (error instanceof FormValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[Form Submit] Error:', error);
    return NextResponse.json(
      { error: 'Nastala neočekávaná chyba.' },
      { status: 500 },
    );
  }
}
