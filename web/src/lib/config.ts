export const config = {
  strapi: {
    url: process.env.STRAPI_URL || 'http://localhost:1337',
    apiToken: process.env.STRAPI_API_TOKEN || '',
  },
  publicUploadsUrl: process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080',
  siteUrl: process.env.SITE_URL || '',
  formTokenSecret: process.env.FORM_TOKEN_SECRET || '',
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.EMAIL_FROM || 'noreply@fotbal-fm.cz',
  },
};
