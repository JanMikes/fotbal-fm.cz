export const config = {
  strapi: {
    url: process.env.STRAPI_URL || 'http://localhost:1337',
    apiToken: process.env.STRAPI_API_TOKEN || '',
  },
  publicUploadsUrl: process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080',
};
