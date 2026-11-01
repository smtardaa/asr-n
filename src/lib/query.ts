/** Filtre/sıralama durumunu URL ile eşler: paylaşılabilir bağlantılar ve geri/ileri gezinme için. */
import type { Locale } from '../config/site';
import type { ProductQuery, SortKey, StockFilter } from './data/types';
import { displayToBase } from './money';

const SORTS: SortKey[] = ['newest', 'price-asc', 'price-desc', 'name', 'relevance'];
const STOCKS: StockFilter[] = ['available', 'sold', 'all'];

const intOr = (v: string | null) => {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};
const numOr = (v: string | null) => {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const list = (sp: URLSearchParams, k: string) => [...new Set(sp.getAll(k).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))].slice(0, 50);

export interface ParsedQuery extends ProductQuery {
  /** Gösterim para birimindeki fiyat sınırları (form alanlarında geri göstermek için) */
  priceMinDisplay?: number;
  priceMaxDisplay?: number;
}

export function parseQuery(sp: URLSearchParams, locale: Locale): ParsedQuery {
  const sort = sp.get('sort') as SortKey | null;
  const stock = sp.get('stock') as StockFilter | null;
  const pmin = numOr(sp.get('price_min'));
  const pmax = numOr(sp.get('price_max'));
  let yf = intOr(sp.get('year_from'));
  let yt = intOr(sp.get('year_to'));
  if (yf != null && yt != null && yf > yt) [yf, yt] = [yt, yf];
  return {
    q: (sp.get('q') ?? '').slice(0, 120).trim() || undefined,
    countries: list(sp, 'country'),
    denominations: list(sp, 'denom'),
    conditions: list(sp, 'cond'),
    materials: list(sp, 'mat'),
    certification: list(sp, 'cert'),
    yearFrom: yf,
    yearTo: yt,
    priceMinDisplay: pmin,
    priceMaxDisplay: pmax,
    priceMin: pmin != null ? displayToBase(pmin, locale) : undefined,
    priceMax: pmax != null ? displayToBase(pmax, locale) : undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    stock: stock && STOCKS.includes(stock) ? stock : undefined,
    page: Math.max(1, intOr(sp.get('page')) ?? 1),
  };
}

/** Herhangi bir filtre etkin mi (sayfa ve sıralama hariç) — canonical ve noindex kararında kullanılır. */
export function hasFilters(q: ParsedQuery): boolean {
  return !!(q.q || q.countries?.length || q.denominations?.length || q.conditions?.length || q.materials?.length || q.certification?.length ||
    q.yearFrom != null || q.yearTo != null || q.priceMinDisplay != null || q.priceMaxDisplay != null || q.stock);
}

/** Mevcut arama parametrelerini değiştirerek yeni URL üretir. value=null → parametreyi siler. */
export function withParams(url: URL, changes: Record<string, string | string[] | null>, resetPage = true): string {
  const sp = new URLSearchParams(url.search);
  for (const [k, v] of Object.entries(changes)) {
    sp.delete(k);
    if (v == null) continue;
    for (const x of Array.isArray(v) ? v : [v]) if (x !== '') sp.append(k, x);
  }
  if (resetPage && !('page' in changes)) sp.delete('page');
  const s = sp.toString();
  return url.pathname + (s ? `?${s}` : '');
}
