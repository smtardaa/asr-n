import { LOCALE_TAGS, PRICING, type CurrencyCode, type Locale } from '../config/site';
import type { Money } from './data/types';

/** Yarım değerleri sıfırdan uzağa yuvarlar; kayan nokta hatasını EPSILON ile dengeler. */
export function roundTo(amount: number, digits: number): number {
  const f = 10 ** digits;
  const sign = amount < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(amount) * f + Number.EPSILON * f)) / f;
}

/**
 * Base para biriminden (TRY) hedef para birimine DEMO kurla dönüştürür.
 * Kur tanımlı değilse hata fırlatır (sessizce yanlış fiyat göstermemek için).
 */
export function convertDemo(money: Money, target: CurrencyCode, rates = PRICING.demoRates): Money {
  if (money.currencyCode === target) return { ...money };
  const from = rates[money.currencyCode];
  const to = rates[target];
  if (!from || !to) throw new Error(`Demo kur tanımlı değil: ${money.currencyCode} → ${target}`);
  const inBase = money.amount * from;
  const digits = PRICING.fractionDigits[target] ?? 2;
  return { amount: roundTo(inBase / to, digits), currencyCode: target };
}

const fmtCache = new Map<string, Intl.NumberFormat>();
export function formatMoney(money: Money, locale: Locale): string {
  const digits = PRICING.fractionDigits[money.currencyCode] ?? 2;
  const key = `${locale}|${money.currencyCode}|${digits}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_TAGS[locale].intl, {
      style: 'currency',
      currency: money.currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    fmtCache.set(key, f);
  }
  return f.format(roundTo(money.amount, digits));
}

export interface PriceView {
  /** Ekranda gösterilen tutar */
  display: Money;
  text: string;
  /** Tahsilat para birimi farklıysa (ör. ödeme TRY) tahsil edilecek tutar */
  charge?: Money;
  chargeText?: string;
  /** Gösterim yaklaşık mı (örnek/demo kur veya TRY tahsilatlı canlı mağaza) */
  approximate: boolean;
}

export interface PricingContext {
  mode: 'demo' | 'shopify';
  checkoutTryOnly: boolean;
}

/**
 * Fiyat gösterimi.
 * - demo: base (TRY) tutar, dilin gösterim para birimine demo kurla çevrilir.
 * - shopify: Shopify'ın pazar bağlamında döndürdüğü tutar olduğu gibi gösterilir (dönüştürme yapılmaz).
 *   Mağaza yalnızca TRY tahsil ediyorsa ve gösterim para birimi farklıysa: yaklaşık tutar + TRY tahsilat tutarı.
 */
export function priceView(price: Money, locale: Locale, ctx: PricingContext): PriceView {
  if (ctx.mode === 'demo') {
    const target = PRICING.displayCurrencyByLocale[locale];
    const display = convertDemo(price, target);
    const approximate = target !== price.currencyCode;
    return {
      display,
      text: formatMoney(display, locale),
      approximate,
      charge: approximate ? price : undefined,
      chargeText: approximate ? formatMoney(price, locale) : undefined,
    };
  }
  // shopify modu
  if (ctx.checkoutTryOnly && price.currencyCode === 'TRY') {
    const target = PRICING.displayCurrencyByLocale[locale];
    if (target !== 'TRY' && PRICING.demoRates[target]) {
      // Yalnızca bilgi amaçlı yaklaşık gösterim; tahsilat TRY
      const display = convertDemo(price, target);
      return { display, text: formatMoney(display, locale), approximate: true, charge: price, chargeText: formatMoney(price, locale) };
    }
  }
  return { display: price, text: formatMoney(price, locale), approximate: false };
}

/** Gösterim para birimindeki bir tutarı base (TRY) tutara çevirir (fiyat filtresi için). */
export function displayToBase(amount: number, locale: Locale): number {
  const target = PRICING.displayCurrencyByLocale[locale];
  const rate = PRICING.demoRates[target] ?? 1;
  return amount * rate;
}

export function baseToDisplay(amount: number, locale: Locale): number {
  const target = PRICING.displayCurrencyByLocale[locale];
  const rate = PRICING.demoRates[target] ?? 1;
  return roundTo(amount / rate, PRICING.fractionDigits[target] ?? 2);
}
