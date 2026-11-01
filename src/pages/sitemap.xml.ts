/**
 * Dinamik sitemap: ürünler, kategoriler ve sabit sayfalar — her dil sürümü ayrı <url> + karşılıklı hreflang.
 * SSR sayfaları otomatik eklenmediği için liste veri sağlayıcısından üretilir; Shopify'a yeni ürün eklendiğinde
 * dizin önbelleği süresi (SHOPIFY_CATALOG_CACHE_TTL) dolunca veya webhook ile temizlenince sitemap de güncellenir.
 * Sepet, arama sonuçları, favoriler ve filtre kombinasyonları DAHİL EDİLMEZ.
 * lastmod yalnızca gerçek updatedAt verisi varsa yazılır (demo verisinde yoktur).
 */
import type { APIRoute } from 'astro';
import { LOCALES, LOCALE_TAGS, DEFAULT_LOCALE } from '../config/site';
import { alternatesFor, type RouteKey } from '../i18n';
import { getProvider, DataSourceError } from '../lib/data';
import { serverEnv } from '../lib/env';
import { absolute } from '../lib/seo';

export const prerender = true;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const env = serverEnv();
  const provider = getProvider();
  const ctx = { locale: DEFAULT_LOCALE };
  let products: Array<{ handle: string; updatedAt?: string }>;
  let categories;
  try {
    [products, categories] = await Promise.all([provider.listAllProductHandles(ctx), provider.getCategories(ctx)]);
  } catch (e) {
    if (e instanceof DataSourceError) return new Response('Sitemap geçici olarak oluşturulamadı.', { status: 503, headers: { 'Retry-After': '300' } });
    throw e;
  }
  const entries: Array<{ alts: Record<string, string>; lastmod?: string }> = [];
  const staticKeys: RouteKey[] = ['home', 'products', 'new', 'sold', 'about', 'contact', 'faq', 'shipping', 'returns', 'privacy', 'distanceSales', 'preInfo', 'kvkk', 'cookies', 'terms'];
  for (const k of staticKeys) entries.push({ alts: alternatesFor(k) });
  for (const c of categories) entries.push({ alts: alternatesFor('category', c.handle) });
  for (const p of products) entries.push({ alts: alternatesFor('product', p.handle), lastmod: p.updatedAt });

  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const e of entries) {
    const links = LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${LOCALE_TAGS[l].hreflang}" href="${esc(absolute(env, e.alts[l]))}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(absolute(env, e.alts[DEFAULT_LOCALE]))}"/>`;
    for (const l of LOCALES) {
      out.push(`<url><loc>${esc(absolute(env, e.alts[l]))}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}${links}</url>`);
    }
  }
  out.push('</urlset>');
  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': `public, max-age=${Math.min(env.shopify.cacheTtl, 3600)}` },
  });
};
