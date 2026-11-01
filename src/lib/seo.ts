/** SEO yardımcıları: canonical, hreflang, robots ve JSON-LD. Tüm mutlak URL'ler SITE_URL'den üretilir. */
import { BUSINESS, DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, type Locale } from '../config/site';
import type { ServerEnv } from './env';
import { pathFor, withBase } from '../i18n';
import type { Product } from './data/types';
import type { PriceView } from './money';

export interface SeoInput {
  title: string;
  description: string;
  /** Kökten yol (ör. /en/product/x). Canonical her zaman sayfanın kendi dil sürümünü gösterir. */
  path: string;
  /** Dil → yol eşlemesi (hreflang). Boşsa yalnızca canonical. */
  alternates?: Partial<Record<Locale, string>>;
  image?: { url: string; width?: number; height?: number; alt?: string };
  type?: 'website' | 'product';
  /** Sayfaya özgü noindex (arama sonuçları, sepet, filtre kombinasyonları) */
  noindex?: boolean;
  jsonLd?: object[];
}

export function absolute(env: Pick<ServerEnv, 'siteUrl'>, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return env.siteUrl + (path.startsWith('/') ? path : `/${path}`);
}

export function hreflangLinks(env: Pick<ServerEnv, 'siteUrl'>, alternates: Partial<Record<Locale, string>>) {
  const links = LOCALES.filter((l) => alternates[l]).map((l) => ({ hreflang: LOCALE_TAGS[l].hreflang, href: absolute(env, alternates[l]!) }));
  if (alternates[DEFAULT_LOCALE]) links.push({ hreflang: 'x-default', href: absolute(env, alternates[DEFAULT_LOCALE]!) });
  return links;
}

export function robotsContent(env: Pick<ServerEnv, 'allowIndexing'>, pageNoindex?: boolean): string {
  if (!env.allowIndexing) return 'noindex, nofollow';
  return pageNoindex ? 'noindex, follow' : 'index, follow';
}

export function truncate(s: string, n = 158): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).replace(/[,;:.\s]+$/, '') + '…';
}

export function breadcrumbLd(env: Pick<ServerEnv, 'siteUrl'>, items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absolute(env, it.path) })),
  };
}

/**
 * Product + Offer JSON-LD. Görünen fiyat/para birimi/stokla birebir aynı değerler kullanılır.
 * Yorum puanı, GTIN, marka, garanti gibi doğrulanmamış alanlar EKLENMEZ.
 */
export function productLd(env: Pick<ServerEnv, 'siteUrl'>, p: Product, opts: { path: string; price: PriceView; locale: Locale; attributes: Array<{ name: string; value: string }> }) {
  const offerPrice = opts.price.display;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: truncate(p.description, 500),
    url: absolute(env, opts.path),
    inLanguage: LOCALE_TAGS[opts.locale].html,
    image: p.images.map((i) => absolute(env, i.url)),
    offers: {
      '@type': 'Offer',
      url: absolute(env, opts.path),
      price: offerPrice.amount.toFixed(2),
      priceCurrency: offerPrice.currencyCode,
      availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };
  if (p.sku) ld.sku = p.sku;
  const cat = p.categories[0];
  if (cat) ld.category = cat.handle;
  if (opts.attributes.length) {
    ld.additionalProperty = opts.attributes.map((a) => ({ '@type': 'PropertyValue', name: a.name, value: a.value }));
  }
  return ld;
}

/** Organization/WebSite: yalnızca dolu işletme bilgileri eklenir. */
export function siteLd(env: Pick<ServerEnv, 'siteUrl'>, locale: Locale, searchPath: string) {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BUSINESS.brandName,
    url: absolute(env, withBase('/')),
    logo: absolute(env, withBase('/brand/logo-512.png')),
  };
  if (BUSINESS.legalName) org.legalName = BUSINESS.legalName;
  if (BUSINESS.email) org.email = BUSINESS.email;
  if (BUSINESS.phone) org.telephone = BUSINESS.phone;
  if (BUSINESS.address) org.address = BUSINESS.address;
  const sameAs = Object.values(BUSINESS.social).filter(Boolean);
  if (sameAs.length) org.sameAs = sameAs;
  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BUSINESS.brandName,
    url: absolute(env, pathFor(locale, 'home')),
    inLanguage: LOCALE_TAGS[locale].html,
    potentialAction: { '@type': 'SearchAction', target: `${absolute(env, searchPath)}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
  return [org, site];
}
