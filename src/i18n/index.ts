import { DEFAULT_LOCALE, LOCALES, type Locale } from '../config/site';
import tr, { type Dict } from './tr';
import en from './en';
import ja from './ja';
import ru from './ru';

const DICTS: Record<Locale, Dict> = { tr, en, ja, ru };

export function dict(locale: Locale): Dict {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

/** "{n} ürün" gibi şablonları doldurur. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Sonuç sayısı — Rusça çoğul biçimleri dahil. */
export function countLabel(locale: Locale, n: number): string {
  const d = dict(locale).listing;
  const num = new Intl.NumberFormat(locale).format(n);
  if (locale === 'ru') {
    const rule = new Intl.PluralRules('ru').select(n);
    const word = rule === 'one' ? 'товар' : rule === 'few' ? 'товара' : 'товаров';
    return `${num} ${word}`;
  }
  if (n === 1) return d.resultsOne;
  return fmt(d.results, { n: num });
}

/* ───────────── Yerelleştirilmiş rotalar ───────────── */

export type RouteKey =
  | 'home' | 'products' | 'category' | 'product' | 'search' | 'new' | 'sold' | 'cart' | 'favorites'
  | 'about' | 'contact' | 'faq' | 'shipping' | 'returns' | 'privacy' | 'distanceSales' | 'preInfo' | 'kvkk' | 'cookies' | 'terms';

const EN_SEGMENTS: Record<Exclude<RouteKey, 'home'>, string> = {
  products: 'products', category: 'category', product: 'product', search: 'search', new: 'new-arrivals', sold: 'sold', cart: 'cart', favorites: 'favorites',
  about: 'about', contact: 'contact', faq: 'faq', shipping: 'shipping', returns: 'returns', privacy: 'privacy-policy', distanceSales: 'distance-sales-agreement',
  preInfo: 'pre-information-form', kvkk: 'personal-data-notice', cookies: 'cookie-policy', terms: 'terms-of-use',
};

export const SEGMENTS: Record<Locale, Record<Exclude<RouteKey, 'home'>, string>> = {
  tr: {
    products: 'urunler', category: 'kategori', product: 'urun', search: 'arama', new: 'yeni-gelenler', sold: 'satilanlar', cart: 'sepet', favorites: 'favoriler',
    about: 'hakkimizda', contact: 'iletisim', faq: 'sss', shipping: 'kargo-ve-teslimat', returns: 'iptal-ve-iade', privacy: 'gizlilik-politikasi',
    distanceSales: 'mesafeli-satis-sozlesmesi', preInfo: 'on-bilgilendirme-formu', kvkk: 'kvkk-aydinlatma-metni', cookies: 'cerez-politikasi', terms: 'kullanim-kosullari',
  },
  en: EN_SEGMENTS,
  ja: EN_SEGMENTS,
  ru: EN_SEGMENTS,
};

/**
 * GitHub Pages sürümü: site bir alt yolda yayınlanır (ör. /depo-adi/). Tüm iç bağlantılar BASE ile önlenir
 * ve statik dizin yapısına uygun olarak "/" ile biter.
 */
const RAW_BASE: string = ((import.meta as { env?: Record<string, string> }).env?.BASE_URL) ?? '/';
export const BASE = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`;

/** Kökten yola alt yol ekler: "/brand/x.webp" → "/depo-adi/brand/x.webp" */
export function withBase(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path;
  if (BASE !== '/' && path.startsWith(BASE)) return path;
  return BASE + path.replace(/^\/+/, '');
}

/** Alt yolu kaldırır: "/depo-adi/urun/x/" → "/urun/x/" */
export function stripBase(pathname: string): string {
  if (BASE !== '/' && pathname.startsWith(BASE)) return '/' + pathname.slice(BASE.length);
  if (BASE !== '/' && pathname === BASE.slice(0, -1)) return '/';
  return pathname;
}

/** Alt yol olmadan, kökten rota yolu (statik sayfa üretimi için). Kök: tr → "/", diğerleri → "/en/". */
export function routePath(locale: Locale, key: RouteKey, param?: string): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  if (key === 'home') return `${prefix}/`;
  const seg = SEGMENTS[locale][key];
  return `${prefix}/${seg}${param ? `/${encodeURIComponent(param)}` : ''}/`;
}

/** Rota anahtarından, alt yol dahil tarayıcıda kullanılacak yolu üretir. */
export function pathFor(locale: Locale, key: RouteKey, param?: string): string {
  return withBase(routePath(locale, key, param));
}

export interface ParsedPath {
  locale: Locale;
  key: RouteKey | null;
  param?: string;
  extra: string[];
}

/** URL yolunu çözümler: dil, rota anahtarı ve parametre. Bilinmeyen yol → key=null (404). */
export function parsePath(pathname: string): ParsedPath {
  const parts = stripBase(pathname).split('/').filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  let locale: Locale = DEFAULT_LOCALE;
  if (parts.length && isLocale(parts[0]) && parts[0] !== DEFAULT_LOCALE) locale = parts.shift() as Locale;
  if (!parts.length) return { locale, key: 'home', extra: [] };
  const seg = parts[0];
  const entry = (Object.entries(SEGMENTS[locale]) as Array<[Exclude<RouteKey, 'home'>, string]>).find(([, s]) => s === seg);
  if (!entry) return { locale, key: null, extra: parts };
  const key = entry[0];
  const needsParam = key === 'category' || key === 'product';
  if (needsParam) {
    if (parts.length !== 2) return { locale, key: null, extra: parts };
    return { locale, key, param: parts[1], extra: [] };
  }
  if (parts.length > 1) return { locale, key: null, extra: parts };
  return { locale, key, extra: [] };
}

/** Aynı sayfanın tüm dillerdeki yolları (hreflang ve dil seçici için). */
export function alternatesFor(key: RouteKey, param?: string): Record<Locale, string> {
  return Object.fromEntries(LOCALES.map((l) => [l, pathFor(l, key, param)])) as Record<Locale, string>;
}
