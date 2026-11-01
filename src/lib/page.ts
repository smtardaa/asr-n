/** Her sayfa isteği için ortak bağlam: dil, sözlük, ortam bayrakları, fiyat görünümü. */
import type { AstroGlobal } from 'astro';
import { PRICING, type Locale } from '../config/site';
import { dict, fmt, pathFor, stripBase, withBase, type RouteKey } from '../i18n';
import { serverEnv } from './env';
import { priceView, type PricingContext } from './money';
import { getProvider } from './data';
import type { Money, Product, RequestContext } from './data/types';
import { conditionLabel } from './labels';

export function pageContext(Astro: AstroGlobal, locale: Locale) {
  const env = serverEnv();
  const t = dict(locale);
  const pricing: PricingContext = { mode: env.dataSource, checkoutTryOnly: env.checkoutTryOnly };
  const req: RequestContext = { locale, buyerIp: clientIp(Astro) };
  return {
    env,
    locale,
    t,
    req,
    provider: getProvider(),
    pricing,
    // Statik çıktıda sorgu dizesi yoktur; sayfanın kendi (alt yol dahil) adresi kullanılır
    url: new URL(withBase(stripBase(Astro.url.pathname)), Astro.url),
    path: (key: RouteKey, param?: string) => pathFor(locale, key, param),
    price: (m: Money) => priceView(m, locale, pricing),
    /** Demo kur notu (yalnızca dönüşüm uygulanan dillerde) */
    rateNote: PRICING.displayCurrencyByLocale[locale] !== PRICING.baseCurrency
      ? fmt(t.demo.rateNote, { rate: String(PRICING.demoRates[PRICING.displayCurrencyByLocale[locale]] ?? '') })
      : '',
  };
}
export type PageCtx = ReturnType<typeof pageContext>;

function clientIp(_Astro: AstroGlobal): string | undefined {
  // Statik sürümde istek başlığı/IP yoktur (sayfalar build sırasında üretilir)
  return undefined;
}

/** Kart/ürün altındaki kısa meta bilgileri (yalnızca dolu alanlar) */
export function productMeta(p: Product, ctx: PageCtx, countryName: (code: string) => string): string[] {
  const a = p.attributes;
  const out: string[] = [];
  if (a.productType) out.push(ctx.t.product.types[a.productType]);
  if (a.country && !a.emission) out.push(countryName(a.country));
  if (a.catalogNumber) out.push(a.catalogNumber);
  if (a.condition) out.push(conditionLabel(a.condition, ctx.locale));
  return out.slice(0, 3);
}
