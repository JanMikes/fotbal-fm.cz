import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface EmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
}

let transporter: nodemailer.Transporter | null = null;
let currentConfigKey = '';

function getTransporter(config: SmtpConfig): nodemailer.Transporter {
  const configKey = `${config.host}:${config.port}:${config.user}`;

  if (!transporter || configKey !== currentConfigKey) {
    const transportConfig: SMTPTransport.Options = {
      host: config.host,
      port: config.port,
      secure: config.secure,
    };

    if (config.user && config.password) {
      transportConfig.auth = {
        user: config.user,
        pass: config.password,
      };
    }

    transporter = nodemailer.createTransport(transportConfig);
    currentConfigKey = configKey;
  }

  return transporter;
}

export async function sendEmail(config: SmtpConfig, options: EmailOptions): Promise<boolean> {
  try {
    const transport = getTransporter(config);

    await transport.sendMail({
      from: config.from,
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
