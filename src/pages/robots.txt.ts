import type { APIRoute } from 'astro';
import { serverEnv } from '../lib/env';
import { absolute } from '../lib/seo';
import { withBase } from '../i18n';

export const prerender = true;

/** Demo/staging'de tümüyle engel; canlıda (DEPLOY_ENV=production + ALLOW_INDEXING=true) sepet/arama/API hariç izin. */
export const GET: APIRoute = () => {
  const env = serverEnv();
  const body = env.allowIndexing
    ? [
        'User-agent: *',
        'Disallow: /api/',
        'Disallow: /sepet', 'Disallow: /*/cart',
        'Disallow: /arama', 'Disallow: /*/search',
        'Disallow: /favoriler', 'Disallow: /*/favorites',
        '',
        `Sitemap: ${absolute(env, withBase('/sitemap.xml'))}`,
      ].join('\n')
    : ['# Demo / staging ortamı — indeksleme kapalı (sayfalarda ayrıca noindex vardır)', 'User-agent: *', 'Disallow: /'].join('\n');
  return new Response(body + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
