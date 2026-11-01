/** Özellik değerlerinin dile göre etiketleri (ülke, malzeme, nominal, hükümdar…). */
import type { Locale } from '../config/site';
import { categoryTitle } from './data';
import type { Category, Product } from './data/types';
import { dict, fmt } from '../i18n';
import unitsJson from '../data/catalog/units.json';

const UNITS = unitsJson as Record<string, Record<Locale, string>>;

const HOME_COUNTRIES: Record<string, Record<Locale, string>> = {
  turkiye: { tr: 'Türkiye', en: 'Türkiye', ja: 'トルコ', ru: 'Турция' },
  'osmanli-imparatorlugu': { tr: 'Osmanlı İmparatorluğu', en: 'Ottoman Empire', ja: 'オスマン帝国', ru: 'Османская империя' },
};

export const MATERIALS: Record<string, Record<Locale, string>> = {
  silver: { tr: 'Gümüş', en: 'Silver', ja: '銀', ru: 'Серебро' },
  gold: { tr: 'Altın', en: 'Gold', ja: '金', ru: 'Золото' },
  bronze: { tr: 'Bronz', en: 'Bronze', ja: '青銅', ru: 'Бронза' },
  brass: { tr: 'Pirinç', en: 'Brass', ja: '黄銅', ru: 'Латунь' },
  nickel: { tr: 'Nikel', en: 'Nickel', ja: 'ニッケル', ru: 'Никель' },
  bimetal: { tr: 'Bimetal', en: 'Bimetallic', ja: 'バイメタル', ru: 'Биметалл' },
};

const AUTHORITY: Record<string, Record<Locale, string>> = {
  Darphane: { tr: 'Darphane', en: 'Turkish State Mint (Darphane)', ja: 'トルコ造幣局（Darphane）', ru: 'Монетный двор Турции (Darphane)' },
};

/** Kaynaktaki Türkçe kondisyon terimleri: diğer dillerde karşılığı + orijinal ifade parantez içinde. */
const CONDITION_TERMS: Record<string, Record<Exclude<Locale, 'tr'>, string>> = {
  'Çil': { en: 'Uncirculated', ja: '未使用', ru: 'UNC' },
  'Çil-': { en: 'Uncirculated−', ja: '未使用−', ru: 'UNC−' },
  'Çil altı': { en: 'About Uncirculated', ja: '準未使用', ru: 'aUNC' },
  'Çok temiz': { en: 'Extremely Fine', ja: '極美品', ru: 'XF' },
  'Çok temiz-': { en: 'Extremely Fine−', ja: '極美品−', ru: 'XF−' },
};
export function conditionLabel(c: string, locale: Locale): string {
  const term = CONDITION_TERMS[c];
  if (!term || locale === 'tr') return c;
  return locale === 'ja' ? `${term.ja}（${c}）` : `${term[locale]} (${c})`;
}

export function makeLabels(locale: Locale, categories: Category[]) {
  const cats = new Map(categories.map((c) => [c.handle, c]));
  const nf = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : locale, { maximumFractionDigits: 2 });
  const t = dict(locale);
  const country = (code: string) => HOME_COUNTRIES[code]?.[locale] ?? (cats.get(code) ? categoryTitle(cats.get(code)!, locale) : code);
  const unit = (u: string) => UNITS[u]?.[locale] ?? u;
  const denomination = (key: string) => {
    const [n, u] = key.split('|');
    return locale === 'ja' ? `${nf.format(Number(n))}${unit(u)}` : `${nf.format(Number(n))} ${unit(u)}`;
  };
  const material = (m: string) => MATERIALS[m]?.[locale] ?? m;
  const ruler = (h: string) => (cats.get(h) ? categoryTitle(cats.get(h)!, locale) : h);
  const category = (h: string) => (cats.get(h) ? categoryTitle(cats.get(h)!, locale) : h);

  /** Ürün özellik tablosu satırları — boş alanlar hiç üretilmez. */
  const specRows = (p: Product): Array<{ name: string; value: string; href?: string }> => {
    const a = p.attributes;
    const L = t.product.attr;
    const rows: Array<{ name: string; value: string; href?: string } | null> = [
      p.sku ? { name: L.sku, value: p.sku } : null,
      a.productType ? { name: L.type, value: t.product.types[a.productType] } : null,
      a.country ? { name: L.country, value: country(a.country) } : null,
      a.ruler ? { name: L.ruler, value: ruler(a.ruler) } : null,
      a.period ? { name: L.period, value: a.period } : null,
      a.emission ? { name: L.emission, value: fmt(t.product.emissionValue, { n: a.emission }) } : null,
      a.tertip ? { name: L.tertip, value: fmt(t.product.tertipValue, { n: a.tertip }) } : null,
      a.yearText ? { name: L.year, value: a.yearText.startsWith('H') ? `${a.yearText.slice(1)} (${locale === 'tr' ? 'Hicrî' : locale === 'ja' ? 'ヒジュラ暦' : locale === 'ru' ? 'хиджра' : 'AH'})` : a.yearText } : null,
      a.denomination != null && a.unit ? { name: L.denomination, value: denomination(`${a.denomination}|${a.unit}`) } : null,
      a.condition ? { name: L.condition, value: conditionLabel(a.condition, locale) } : null,
      a.catalogNumber ? { name: L.catalogNumber, value: `${a.catalogNumber} (Pick)` } : null,
      a.material ? { name: L.material, value: material(a.material) } : null,
      a.certification ? { name: L.certification, value: [AUTHORITY[a.certification.authority]?.[locale] ?? a.certification.authority, a.certification.grade].filter(Boolean).join(' ') } : null,
    ];
    return rows.filter((r): r is { name: string; value: string } => !!r);
  };

  const condition = (c: string) => conditionLabel(c, locale);
  return { country, unit, denomination, material, ruler, category, condition, specRows };
}
export type Labels = ReturnType<typeof makeLabels>;
