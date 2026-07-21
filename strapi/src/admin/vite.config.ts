import fs from 'node:fs/promises';
import path from 'node:path';
import { mergeConfig, type PluginOption, type UserConfig } from 'vite';

/**
 * Strapi renders the admin index.html from its internal DefaultDocument
 * component with a hardcoded `lang="en"`, so Chrome offers to machine-translate
 * the panel even to editors who already switched it to Czech. Google Translate
 * swaps text nodes out from under React, which then throws
 * `NotFoundError: Failed to execute 'removeChild' on 'Node'` and takes the whole
 * panel down with the "Something went wrong" error boundary.
 *
 * That document is generated outside Vite's HTML pipeline, so transformIndexHtml
 * never fires for it — patch the emitted file once the bundle is written.
 */
const disableMachineTranslation = (): PluginOption => {
  let outDir = '';

  return {
    name: 'strapi-admin-notranslate',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const indexPath = path.join(outDir, 'index.html');
      const html = await fs.readFile(indexPath, 'utf8');

      if (html.includes('content="notranslate"')) {
        return;
      }

      const patched = html
        .replace(/<html\b/, '<html translate="no"')
        .replace(/<head(\s[^>]*)?>/, '$&<meta name="google" content="notranslate"/>');

      await fs.writeFile(indexPath, patched, 'utf8');
    },
  };
};

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    plugins: [disableMachineTranslation()],
  });
};
