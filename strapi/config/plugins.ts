export default ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'mailpit'),
        port: env.int('SMTP_PORT', 1025),
        secure: env.bool('SMTP_SECURE', false),
        ...(env('SMTP_USER', '') && {
          auth: {
            user: env('SMTP_USER'),
            pass: env('SMTP_PASSWORD'),
          },
        }),
      },
      settings: {
        defaultFrom: env('EMAIL_FROM', 'noreply@fotbal-fm.cz'),
        defaultReplyTo: env('EMAIL_FROM', 'noreply@fotbal-fm.cz'),
      },
    },
  },
});
