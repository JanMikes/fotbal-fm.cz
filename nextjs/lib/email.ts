import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as Sentry from '@sentry/nextjs';
import { config, isDevelopment } from './config';

export interface EmailOptions {
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Get or create the email transporter (singleton)
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const transportConfig: SMTPTransport.Options = {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE === 'true',
    };

    // Only add auth if credentials are provided (not needed for mailpit)
    if (config.SMTP_USER && config.SMTP_PASSWORD) {
      transportConfig.auth = {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      };
    }

    transporter = nodemailer.createTransport(transportConfig);
  }

  return transporter;
}

/**
 * Send email - returns success/failure status
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: config.EMAIL_FROM,
      to: config.EMAIL_TO,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    if (isDevelopment()) {
      console.log(`[Email] Sent: ${options.subject}`);
    }

    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    Sentry.captureException(error, {
      tags: { component: 'email' },
      extra: { subject: options.subject },
    });
    return false;
  }
}

/**
 * Fire-and-forget email sending - NON-BLOCKING
 * Ensures the main operation always succeeds regardless of email status
 */
export function sendEmailAsync(options: EmailOptions): void {
  setImmediate(() => {
    sendEmail(options).catch((error) => {
      console.error('[Email] Async send failed:', error);
      Sentry.captureException(error, {
        tags: { component: 'email', async: true },
        extra: { subject: options.subject },
      });
    });
  });
}
