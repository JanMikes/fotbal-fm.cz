export const config = {
  strapi: {
    url: process.env.STRAPI_URL || 'http://localhost:1337',
    apiToken: process.env.STRAPI_API_TOKEN || '',
  },
  publicUploadsUrl: process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080',
  internalUploadsUrl: process.env.INTERNAL_UPLOADS_URL || process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080',
  siteUrl: process.env.SITE_URL || '',
  formTokenSecret: process.env.FORM_TOKEN_SECRET || '',
  /**
   * Identifiers of the club's mobile app (Wantoo-cz/fotbal-fm-mobile-app). They feed the
   * Universal Links / App Links association files under /.well-known and the deep-link
   * landing page. Defaults match the store builds; override only when the app changes.
   */
  mobileApp: {
    iosAppId: process.env.MOBILE_IOS_APP_ID || '9C729Z8P28.com.wantoo.fkfm',
    iosAppStoreId: process.env.MOBILE_IOS_APP_STORE_ID || '6750488459',
    androidPackage: process.env.MOBILE_ANDROID_PACKAGE || 'com.wantoo.fkfm',
    androidSha256Fingerprints: (
      process.env.MOBILE_ANDROID_SHA256_FINGERPRINTS ||
      'C2:A9:55:3D:55:9A:92:6C:BC:94:F8:9B:8C:FC:97:37:89:F7:FD:3E:88:57:C1:27:20:83:E4:D4:AD:AA:A1:4D,' +
      '1A:65:9D:C6:A1:EB:AD:30:18:9F:CD:39:BC:52:8B:2F:54:32:C3:5D:B1:F8:71:58:DF:C8:A5:6B:E8:88:02:4F'
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    urlScheme: process.env.MOBILE_URL_SCHEME || 'fkfm',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.EMAIL_FROM || 'noreply@fotbal-fm.cz',
  },
};
