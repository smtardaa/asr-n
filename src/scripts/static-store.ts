/**
 * GitHub Pages sürümü — tarayıcı tarafı katalog: sunucu yerine aynı arama/filtre motoru (catalog-engine) ve
 * aynı fiyat fonksiyonu (money.ts) burada çalışır. Veri: /data/catalog-<dil>.json (build sırasında üretilir).
 */
import { indexProduct, runQuery, type IndexedProduct } from '../lib/catalog-engine';
import { parseQuery } from '../lib/query';
import { formatMoney, priceView } from '../lib/money';
import type { Locale } from '../config/site';
import type { Product, ProductAttributes, ProductListResult, ProductQuery } from '../lib/data/types';

export interface Item {
  h: string; v: string; t: string; u: string; img: [string, string, number, number, string] | null; m: string[]; cl: string; s: string;
  p: number; pt: string; pa: boolean; pc: string | null; a: boolean; q: number; n: number; nw: boolean; c: string[]; at: ProductAttributes; x: string;
}
interface Data { locale: Locale; categories: Array<{ h: string; p: string | null }>; items: Item[] }

let dataPromise: Promise<Data> | null = null;
export function loadData(url: string): Promise<Data> {
  dataPromise ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Data>;
  });
  return dataPromise;
}

let indexCache: { index: IndexedProduct[]; byHandle: Map<string, Item> } | null = null;
function buildIndex(d: Data) {
  if (indexCache) return indexCache;
  const index = d.items.map((it) => {
    const p: Product = {
      id: it.h, handle: it.h, variantId: it.v, sku: it.s || undefined, title: it.t, description: '', attributes: it.at,
      categories: it.c.map((h) => ({ handle: h, path: [h] })), images: [], price: { amount: it.p, currencyCode: 'TRY' },
      available: it.a, quantityAvailable: it.q, newness: it.n, isNew: it.nw, tags: [], isDemo: true,
    };
    return indexProduct(p, it.x);
  });
  indexCache = { index, byHandle: new Map(d.items.map((it) => [it.h, it])) };
  return indexCache;
}

function descendants(d: Data, handle: string): Set<string> {
  const out = new Set([handle]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of d.categories) if (c.p && out.has(c.p) && !out.has(c.h)) { out.add(c.h); grew = true; }
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ICON = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17"/></svg>',
};

export interface CardStrings { sold: string; isNew: string; favAdd: string; addToCart: string; inStock: string }

/** ProductCard.astro ile aynı işaretleme. */
export function cardHTML(it: Item, S: CardStrings, heading: 'h2' | 'h3' = 'h2'): string {
  const tag = !it.a ? `<span class="tag tag-sold">${esc(S.sold)}</span>` : it.nw ? `<span class="tag tag-new">${esc(S.isNew)}</span>` : '';
  const img = it.img
    ? `<img src="${esc(it.img[0])}" srcset="${esc(it.img[0])} 320w, ${esc(it.img[1])} 640w" sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 280px" width="${Math.round(it.img[2] / 2)}" height="${Math.round(it.img[3] / 2)}" alt="${esc(it.img[4])}" loading="lazy" decoding="async">`
    : '<span class="noimg">—</span>';
  const meta = it.m.length ? `<p class="card-meta">${it.m.map((m) => `<span>${esc(m)}</span>`).join('')}</p>` : '';
  const cart = it.a
    ? `<button class="cart-btn" type="button" data-add-to-cart="${esc(JSON.stringify({ handle: it.h, variantId: it.v, price: it.p, max: it.q }))}" aria-label="${esc(`${S.addToCart}: ${it.t}`)}">${ICON.cart}</button>`
    : '';
  return `<li><article class="card${it.a ? '' : ' is-sold'}">${tag}`
    + `<button class="fav-btn" type="button" aria-pressed="false" data-fav="${esc(it.h)}" aria-label="${esc(`${S.favAdd}: ${it.t}`)}">${ICON.heart}</button>`
    + `<div class="card-media">${img}</div><div class="card-body"><${heading} class="card-title"><a href="${esc(it.u)}">${esc(it.t)}</a></${heading}>${meta}`
    + `<div class="card-foot"><p class="price" style="margin:0"><span class="sr-only">${esc(it.a ? S.inStock : S.sold)}: </span>${it.pa ? '<span aria-hidden="true">≈ </span>' : ''}${esc(it.pt)}`
    + `${it.pa && it.pc ? `<span class="price-approx">${esc(it.pc)}</span>` : ''}</p>${cart}</div></div></article></li>`;
}

/* ───────────────────────── Listeleme ───────────────────────── */

export interface ListingConfig {
  mode: 'products' | 'category' | 'search' | 'new' | 'sold';
  category?: string;
  defaultStock: 'available' | 'sold';
  allProductsUrl: string;
  displayCurrency: string;
  S: CardStrings & {
    resultsOne: string; results: string; noResults: string; noResultsHint: string; clear: string; examples: string; allProducts: string;
    prev: string; next: string; page: string; removeFilter: string; year: string; price: string; stock: string; stockAvailable: string; stockSold: string; stockAll: string;
    searchFor: string; searchEmpty: string; pagination: string;
  };
}

const LISTING_PARAMS = ['q', 'country', 'denom', 'cond', 'mat', 'cert', 'year_from', 'year_to', 'price_min', 'price_max', 'stock', 'sort', 'page'];

export async function initListing(locale: Locale, intl: string, dataUrl: string, afterRender: () => void) {
  const cfgEl = document.getElementById('listing-config');
  const root = document.querySelector<HTMLElement>('[data-results]');
  if (!cfgEl || !root) return;
  const L: ListingConfig = JSON.parse(cfgEl.textContent || '{}');
  const S = L.S;
  const sp = new URLSearchParams(location.search);
  const form = document.querySelector<HTMLFormElement>('[data-filter-form]');

  // Form alanlarını URL ile eşle (statik HTML varsayılan durumdadır)
  const qv = sp.get('q') ?? '';
  document.querySelectorAll<HTMLInputElement>('[data-q-input], #site-search').forEach((i) => { i.value = qv; });
  if (!LISTING_PARAMS.some((k) => sp.has(k)) || L.mode === 'new') return;

  root.setAttribute('aria-busy', 'true');
  let d: Data;
  try { d = await loadData(dataUrl); } catch { root.removeAttribute('aria-busy'); return; }
  const { index } = buildIndex(d);
  const byHandle = new Map(d.items.map((it) => [it.h, it]));
  const q = parseQuery(sp, locale);
  const query: ProductQuery = { ...q, stock: L.mode === 'sold' ? 'sold' : q.stock, category: L.category };
  const res: ProductListResult = runQuery(index, query, { categoryHandles: L.category ? descendants(d, L.category) : undefined });
  const nf = new Intl.NumberFormat(intl);

  // Başlık (arama)
  if (L.mode === 'search' && qv) {
    const h1 = document.querySelector('.page-head h1');
    if (h1) h1.textContent = S.searchFor.replace('{q}', qv);
    document.title = document.title.replace(/^[^|]+/, `${S.searchFor.replace('{q}', qv)} `);
  }

  // Sonuç sayısı
  const count = document.getElementById('results-count');
  if (count) {
    if (locale === 'ru') {
      const r = new Intl.PluralRules('ru').select(res.total);
      count.textContent = `${nf.format(res.total)} ${r === 'one' ? 'товар' : r === 'few' ? 'товара' : 'товаров'}`;
    } else count.textContent = res.total === 1 ? S.resultsOne : S.results.replace('{n}', nf.format(res.total));
  }

  // Filtre denetimleri ve facet sayıları
  if (form) {
    const facetMap: Record<string, Array<{ value: string; count: number }>> = {
      country: res.facets.countries, denom: res.facets.denominations, cond: res.facets.conditions, mat: res.facets.materials, cert: res.facets.certification,
    };
    const selected: Record<string, string[] | undefined> = { country: q.countries, denom: q.denominations, cond: q.conditions, mat: q.materials, cert: q.certification };
    for (const [name, list] of Object.entries(facetMap)) {
      const counts = new Map(list.map((f) => [f.value, f.count]));
      form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`).forEach((inp) => {
        inp.checked = !!selected[name]?.includes(inp.value);
        const n = inp.closest('label')?.querySelector('.n');
        if (n) n.textContent = String(counts.get(inp.value) ?? 0);
      });
    }
    const stock = query.stock ?? L.defaultStock;
    form.querySelectorAll<HTMLInputElement>('input[name="stock"]').forEach((inp) => {
      const v = inp.value || L.defaultStock;
      inp.checked = v === stock;
      const n = inp.closest('label')?.querySelector('.n');
      if (n) n.textContent = String(v === 'available' ? res.facets.stock.available : v === 'sold' ? res.facets.stock.sold : res.facets.stock.available + res.facets.stock.sold);
    });
    const setVal = (name: string, v?: number) => { const i = form.querySelector<HTMLInputElement>(`input[name="${name}"]`); if (i) i.value = v != null ? String(v) : ''; };
    setVal('year_from', q.yearFrom); setVal('year_to', q.yearTo); setVal('price_min', q.priceMinDisplay); setVal('price_max', q.priceMaxDisplay);
  }
  const sortSel = document.querySelector<HTMLSelectElement>('[data-sort-select]');
  if (sortSel) {
    if (q.q && !sortSel.querySelector('option[value="relevance"]')) sortSel.insertAdjacentHTML('afterbegin', `<option value="relevance">${esc(sortSel.dataset.relevance || 'Relevance')}</option>`);
    sortSel.value = q.sort ?? (q.q ? 'relevance' : 'newest');
  }

  // Etkin filtre çipleri
  const base = location.pathname;
  const urlWithout = (k: string, v?: string) => {
    const s = new URLSearchParams(location.search);
    s.delete('page');
    if (v) { const rest = s.getAll(k).flatMap((x) => x.split(',')).filter((x) => x !== v); s.delete(k); rest.forEach((x) => s.append(k, x)); } else s.delete(k);
    const str = s.toString();
    return base + (str ? `?${str}` : '');
  };
  const labelOf = (name: string, v: string) => {
    const lab = form?.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(v)}"]`)?.closest('label');
    if (!lab) return v;
    const clone = lab.cloneNode(true) as HTMLElement;
    clone.querySelector('.n')?.remove();
    return clone.textContent?.trim() || v;
  };
  const chips: Array<{ label: string; href: string }> = [];
  if (L.mode !== 'search' && q.q) chips.push({ label: `“${q.q}”`, href: urlWithout('q') });
  for (const [k, vals] of [['country', q.countries], ['denom', q.denominations], ['cond', q.conditions], ['mat', q.materials], ['cert', q.certification]] as const) {
    vals?.forEach((v) => chips.push({ label: labelOf(k, v), href: urlWithout(k, v) }));
  }
  if (q.yearFrom != null || q.yearTo != null) {
    const s = new URLSearchParams(location.search); s.delete('year_from'); s.delete('year_to'); s.delete('page');
    chips.push({ label: `${S.year}: ${q.yearFrom ?? '…'}–${q.yearTo ?? '…'}`, href: base + (s.toString() ? `?${s}` : '') });
  }
  if (q.priceMinDisplay != null || q.priceMaxDisplay != null) {
    const s = new URLSearchParams(location.search); s.delete('price_min'); s.delete('price_max'); s.delete('page');
    chips.push({ label: `${S.price}: ${q.priceMinDisplay ?? '…'}–${q.priceMaxDisplay ?? '…'} ${L.displayCurrency}`, href: base + (s.toString() ? `?${s}` : '') });
  }
  if (q.stock && q.stock !== L.defaultStock) chips.push({ label: `${S.stock}: ${q.stock === 'sold' ? S.stockSold : q.stock === 'all' ? S.stockAll : S.stockAvailable}`, href: urlWithout('stock') });
  const clearHref = L.mode === 'search' && q.q ? `${base}?q=${encodeURIComponent(q.q)}` : base;
  const chipsBox = document.querySelector<HTMLElement>('[data-chips]');
  if (chipsBox) {
    chipsBox.innerHTML = chips.length
      ? `<ul class="chips">${chips.map((c) => `<li><a class="chip" href="${esc(c.href)}" aria-label="${esc(S.removeFilter.replace('{name}', c.label))}">${esc(c.label)}${ICON.x}</a></li>`).join('')}<li><a class="chip" href="${esc(clearHref)}">${esc(S.clear)}</a></li></ul>`
      : '';
  }
  const filterCount = document.querySelector<HTMLElement>('[data-filter-count]');
  if (filterCount) filterCount.textContent = chips.length ? ` (${chips.length})` : '';

  // Sonuçlar
  if (res.items.length) {
    const items = res.items.map((p) => byHandle.get(p.handle)).filter((x): x is Item => !!x);
    let html = `<ul class="grid cols-3">${items.map((it) => cardHTML(it, S)).join('')}</ul>`;
    if (res.pageCount > 1) {
      const href = (n: number) => { const s = new URLSearchParams(location.search); if (n > 1) s.set('page', String(n)); else s.delete('page'); const str = s.toString(); return base + (str ? `?${str}` : ''); };
      const pages: Array<number | 'gap'> = [];
      for (let i = 1; i <= res.pageCount; i++) {
        if (i === 1 || i === res.pageCount || Math.abs(i - res.page) <= 1) pages.push(i);
        else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
      }
      html += `<nav class="pagination" aria-label="${esc(S.pagination)}">`
        + (res.page > 1 ? `<a href="${esc(href(res.page - 1))}" rel="prev">‹ <span>${esc(S.prev)}</span></a>` : '')
        + pages.map((n) => n === 'gap' ? '<span class="gap" aria-hidden="true">…</span>'
          : n === res.page ? `<span aria-current="page"><span class="sr-only">${esc(S.page.replace('{n}', String(n)))}</span><span aria-hidden="true">${n}</span></span>`
            : `<a href="${esc(href(n))}" aria-label="${esc(S.page.replace('{n}', String(n)))}">${n}</a>`).join('')
        + (res.page < res.pageCount ? `<a href="${esc(href(res.page + 1))}" rel="next"><span>${esc(S.next)}</span> ›</a>` : '')
        + '</nav>';
    }
    root.innerHTML = html;
  } else {
    root.innerHTML = `<div class="empty">`
      + (L.mode === 'search' && !qv ? `<h2>${esc(S.searchEmpty)}</h2>` : `<h2>${esc(S.noResults)}</h2><p class="muted">${esc(S.noResultsHint)}</p>${chips.length ? `<a class="btn btn-outline" href="${esc(clearHref)}">${esc(S.clear)}</a>` : ''}`)
      + `<p class="muted" style="margin-top:16px">${esc(S.examples)}</p><a class="btn btn-primary" href="${esc(L.allProductsUrl)}">${esc(S.allProducts)}</a></div>`;
  }
  root.removeAttribute('aria-busy');
  afterRender();
}

/* ───────────────────────── Favoriler ───────────────────────── */

export async function renderFavorites(handles: string[], dataUrl: string, S: CardStrings, afterRender: () => void) {
  const box = document.querySelector<HTMLElement>('[data-favorites-list]');
  const empty = document.querySelector<HTMLElement>('[data-fav-empty]');
  if (!box || !empty) return;
  if (!handles.length) { box.innerHTML = ''; empty.hidden = false; return; }
  const d = await loadData(dataUrl);
  const m = new Map(d.items.map((it) => [it.h, it]));
  const items = handles.map((h) => m.get(h)).filter((x): x is Item => !!x);
  empty.hidden = items.length > 0;
  box.innerHTML = items.length ? `<ul class="grid">${items.map((it) => cardHTML(it, S)).join('')}</ul>` : '';
  afterRender();
}

/* ───────────────────────── Sepet ───────────────────────── */

export interface LineIn { handle: string; variantId: string; quantity: number; seenPrice?: number }
export interface LineOut {
  handle: string; variantId: string; quantity: number; max: number; available: boolean; unitPrice: number; title: string; url: string;
  image: string | null; imageAlt: string; meta: string; unitText: string; lineText: string; warnings: string[];
}

/** /api/cart/sync ile aynı yanıt biçimi; doğrulama tarayıcıda, aynı fiyat fonksiyonuyla. */
export async function localCart(lines: LineIn[], locale: Locale, dataUrl: string, W: { warnSoldOut: string; warnQty: string; warnPrice: string; warnMissing: string; chargeLabel: string }) {
  const d = await loadData(dataUrl);
  const m = new Map(d.items.map((it) => [it.h, it]));
  const pricing = { mode: 'demo' as const, checkoutTryOnly: true };
  const fmtTry = (a: number) => priceView({ amount: a, currencyCode: 'TRY' }, locale, pricing).text;
  const out: LineOut[] = [];
  const missing: Array<{ handle: string; text: string }> = [];
  let blocking = false, sum = 0, count = 0;
  for (const l of lines) {
    const it = m.get(l.handle);
    if (!it) { missing.push({ handle: l.handle, text: W.warnMissing }); blocking = true; continue; }
    let qty = Math.max(1, Math.floor(l.quantity || 1));
    const warnings: string[] = [];
    if (!it.a) { warnings.push(W.warnSoldOut); blocking = true; }
    else if (qty > it.q) { qty = it.q; warnings.push(W.warnQty.replace('{n}', String(qty))); blocking = true; }
    if (l.seenPrice != null && Math.abs(l.seenPrice - it.p) > 0.001) { warnings.push(W.warnPrice.replace('{from}', fmtTry(l.seenPrice)).replace('{to}', fmtTry(it.p))); blocking = true; }
    const lineAmount = it.a ? it.p * qty : 0;
    sum += lineAmount; count += qty;
    out.push({
      handle: it.h, variantId: it.v, quantity: qty, max: it.q, available: it.a, unitPrice: it.p, title: it.t, url: it.u,
      image: it.img?.[0] ?? null, imageAlt: it.img?.[4] ?? '', meta: [it.cl, it.s].filter(Boolean).join(' · '),
      unitText: it.pt, lineText: fmtTry(lineAmount), warnings,
    });
  }
  const sub = priceView({ amount: sum, currencyCode: 'TRY' }, locale, pricing);
  return {
    cartId: undefined, mode: 'demo', lines: out, missing, hasBlockingWarnings: blocking, count,
    subtotalText: sub.text, chargeText: sub.approximate ? `${W.chargeLabel}: ${formatMoney({ amount: sum, currencyCode: 'TRY' }, locale)}` : null,
  };
}
