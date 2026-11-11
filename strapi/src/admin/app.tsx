import favicon from './extensions/favicon.png';
import cs from './translations/cs.json';

// Czech is the default interface language. Strapi reads it from localStorage before the first render
// and otherwise falls back to English; an admin who picks a language in their profile keeps it
// (Strapi stores it in localStorage and on the user, which wins at login).
try {
  if (!window.localStorage.getItem('strapi-admin-language')) {
    window.localStorage.setItem('strapi-admin-language', 'cs');
  }
} catch {
  // storage blocked — Strapi falls back to English
}

export default {
  config: {
    head: {
      favicon: favicon,
    },
    locales: ['cs'],
    // Strapi's own Czech leaves the media library and newer screens in English; these fill the gaps
    // (keys as in Strapi's en.json, plugin keys prefixed with the plugin id). Settings pages that only
    // the super admin opens are left out.
    translations: {
      cs,
    },
  },
  bootstrap() {},
};
