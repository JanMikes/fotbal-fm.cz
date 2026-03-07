import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { config } from './config';

export interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const transportConfig: SMTPTransport.Options = {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
    };

    if (config.smtp.user && config.smtp.password) {
      transportConfig.auth = {
        user: config.smtp.user,
        pass: config.smtp.password,
      };
    }

    transporter = nodemailer.createTransport(transportConfig);
  }

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: config.smtp.from,
      to: options.to.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
      attachments: options.attachments,
    });

    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}
