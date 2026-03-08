import { sendEmail as _sendEmail, type EmailOptions } from '@fotbal-fm/form/email';
import { config } from './config';

export type { EmailOptions };

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  return _sendEmail(config.smtp, options);
}
