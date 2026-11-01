/**
 * Katalog arama / filtreleme / sıralama motoru.
 * Demo sağlayıcısı ve Shopify "dizin modu" aynı motoru kullanır (bkz. docs/SHOPIFY.md — arama eşlemesi).
 */
import { CATALOG, SOLD_PRODUCTS } from '../config/site';
import type { FacetValue, Product, ProductListResult, ProductQuery } from './data/types';
import { fold, tokens } from './text';

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;

export interface IndexedProduct {
  product: Product;
  words: Set<string>; // katlanmış sözcükler
  numbers: Set<number>; // nominal, emisyon, tertip, katalog numarası rakamları
  text: string; // katlanmış tam metin (CJK alt dize araması için)
  titleWords: Set<string>;
}

/** Türk 10'luk kondisyon ifadesi ("10/9,5", "10 /7.5"). Bu sayılar nominal/yıl gibi sayı eşleşmesine katılmaz. */
const COND_RX = /(?<![\d.,])10\s*\/\s*[,.]?\d{1,2}(?:[,.]\d+)?(?!\d)/g;
const normCond = (s: string) => s.replace(/\s/g, '').replace('/.', '/').replace('/,', '/').replace('.', ',');

export function indexProduct(p: Product, extraText = ''): IndexedProduct {
  const a = p.attributes;
  const parts = [
    p.title, p.sku ?? '', extraText, a.condition ?? '', a.catalogNumber ?? '', a.catalogNumber?.replace(/^P-/, '') ?? '',
    a.yearText ?? '', a.denominationText ?? '', a.unit ?? '', a.emission ? `${a.emission} emisyon ${a.emission}. emisyon` : '',
    a.tertip ? `${a.tertip} tertip` : '', a.certification ? `${a.certification.authority} ${a.certification.grade ?? ''}` : '',
  ];
  const text = fold(parts.join(' '));
  const words = new Set(tokens(parts.join(' ')).filter((t) => !/^\d+$/.test(t)));
  const numbers = new Set<number>();
  for (const t of tokens(parts.join(' ').replace(COND_RX, ' '))) if (/^\d+$/.test(t)) numbers.add(Number(t));
  if (a.denomination != null) numbers.add(a.denomination);
  return { product: p, words, numbers, text, titleWords: new Set(tokens(p.title)) };
}

/** Sorgu ↔ ürün eşleşme puanı. 0 = eşleşmedi. Her sorgu belirteci bir alanla eşleşmelidir (VE mantığı). */
export function matchScore(ix: IndexedProduct, q: string): number {
  const a = ix.product.attributes;
  let score = 0;
  // Kondisyon ifadesi sorguda bütün olarak aranır (ör. "10/9" yalnız 10/9 kondisyonlu ürünleri bulur)
  const conds: string[] = [];
  const rest = q.replace(COND_RX, (m) => { conds.push(normCond(m)); return ' '; });
  for (const c of conds) {
    if (!a.condition || normCond(a.condition) !== c) return 0;
    score += 3;
  }
  const qt = tokens(rest);
  if (!qt.length) return conds.length ? score : 1;
  for (const t of qt) {
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      let hit = false;
      if (t.length === 4 && a.yearFrom != null && n >= a.yearFrom && n <= (a.yearTo ?? a.yearFrom)) { score += 3; hit = true; }
      if (a.denomination === n) { score += 3; hit = true; }
      if (!hit && ix.numbers.has(n)) { score += 1; hit = true; }
      if (!hit) return 0;
      continue;
    }
    if (CJK.test(t)) {
      if (!ix.text.includes(t)) return 0;
      score += 2;
      continue;
    }
    if (ix.words.has(t)) { score += ix.titleWords.has(t) ? 3 : 2; continue; }
    let pref = false;
    if (t.length >= 2) for (const w of ix.words) if (w.startsWith(t)) { pref = true; break; }
    if (pref) { score += 1; continue; }
    if (t.length >= 3 && ix.text.includes(t)) { score += 0.5; continue; }
    return 0;
  }
  return score;
}

export function denomKey(p: Product): string | null {
  const a = p.attributes;
  return a.denomination != null && a.unit ? `${a.denomination}|${a.unit}` : null;
}

type Pred = (ix: IndexedProduct) => boolean;

export function runQuery(
  index: IndexedProduct[],
  query: ProductQuery,
  opts: { categoryHandles?: Set<string> } = {},
): ProductListResult {
  const stock = query.stock ?? (SOLD_PRODUCTS.showSoldInListings ? 'all' : 'available');
  const preds: Record<string, Pred> = {};
  const scores = new Map<IndexedProduct, number>();

  if (opts.categoryHandles) {
    const set = opts.categoryHandles;
    preds.category = (ix) => ix.product.categories.some((c) => set.has(c.handle));
  }
  if (query.q?.trim()) {
    const q = query.q;
    preds.q = (ix) => {
      const s = matchScore(ix, q);
      if (s > 0) scores.set(ix, s);
      return s > 0;
    };
  }
  if (query.countries?.length) {
    const s = new Set(query.countries);
    preds.country = (ix) => !!ix.product.attributes.country && s.has(ix.product.attributes.country);
  }
  if (query.yearFrom != null || query.yearTo != null) {
    const lo = query.yearFrom ?? -Infinity, hi = query.yearTo ?? Infinity;
    preds.year = (ix) => {
      const a = ix.product.attributes;
      if (a.yearFrom == null) return false;
      return (a.yearTo ?? a.yearFrom) >= lo && a.yearFrom <= hi;
    };
  }
  if (query.denominations?.length) {
    const s = new Set(query.denominations);
    preds.denomination = (ix) => { const k = denomKey(ix.product); return !!k && s.has(k); };
  }
  if (query.conditions?.length) {
    const s = new Set(query.conditions);
    preds.condition = (ix) => !!ix.product.attributes.condition && s.has(ix.product.attributes.condition);
  }
  if (query.materials?.length) {
    const s = new Set(query.materials);
    preds.material = (ix) => !!ix.product.attributes.material && s.has(ix.product.attributes.material);
  }
  if (query.certification?.length) {
    const s = new Set(query.certification);
    preds.certification = (ix) => !!ix.product.attributes.certification && s.has(ix.product.attributes.certification.authority);
  }
  if (query.priceMin != null || query.priceMax != null) {
    const lo = query.priceMin ?? -Infinity, hi = query.priceMax ?? Infinity;
    preds.price = (ix) => ix.product.price.amount >= lo && ix.product.price.amount <= hi;
  }
  if (stock !== 'all') preds.stock = (ix) => (stock === 'available' ? ix.product.available : !ix.product.available);

  const passAll = (ix: IndexedProduct, except?: string) => {
    for (const [k, fn] of Object.entries(preds)) if (k !== except && !fn(ix)) return false;
    return true;
  };

  const matched = index.filter((ix) => passAll(ix));

  // Ayrık (disjunctive) facet'ler: her facet kendi filtresi hariç diğerleriyle hesaplanır
  const facetOf = (except: string, key: (ix: IndexedProduct) => string | undefined | null): FacetValue[] => {
    const c = new Map<string, number>();
    for (const ix of index) {
      if (!passAll(ix, except)) continue;
      const v = key(ix);
      if (v) c.set(v, (c.get(v) ?? 0) + 1);
    }
    return [...c.entries()].map(([value, count]) => ({ value, count })).sort((x, y) => y.count - x.count || x.value.localeCompare(y.value));
  };
  const years = matched.map((ix) => ix.product.attributes.yearFrom).filter((y): y is number => y != null);
  const prices = matched.map((ix) => ix.product.price.amount);
  const stockBase = index.filter((ix) => passAll(ix, 'stock'));

  const sort = query.sort ?? (query.q ? 'relevance' : 'newest');
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const sorted = [...matched].sort((x, y) => {
    const px = x.product, py = y.product;
    // Satılanlar her zaman mevcutların ardından
    if (px.available !== py.available) return px.available ? -1 : 1;
    switch (sort) {
      case 'price-asc': return px.price.amount - py.price.amount;
      case 'price-desc': return py.price.amount - px.price.amount;
      case 'name': return collator.compare(px.title, py.title);
      case 'relevance': return (scores.get(y) ?? 0) - (scores.get(x) ?? 0) || py.newness - px.newness;
      default: return py.newness - px.newness;
    }
  });

  const pageSize = query.pageSize ?? CATALOG.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize).map((ix) => ix.product),
    total: sorted.length,
    page,
    pageCount,
    facets: {
      countries: facetOf('country', (ix) => ix.product.attributes.country),
      years: { min: years.length ? Math.min(...years) : undefined, max: years.length ? Math.max(...years) : undefined },
      denominations: facetOf('denomination', (ix) => denomKey(ix.product)),
      conditions: facetOf('condition', (ix) => ix.product.attributes.condition),
      materials: facetOf('material', (ix) => ix.product.attributes.material),
      certification: facetOf('certification', (ix) => ix.product.attributes.certification?.authority),
      price: { min: prices.length ? Math.min(...prices) : undefined, max: prices.length ? Math.max(...prices) : undefined },
      stock: { available: stockBase.filter((ix) => ix.product.available).length, sold: stockBase.filter((ix) => !ix.product.available).length },
    },
  };
}
