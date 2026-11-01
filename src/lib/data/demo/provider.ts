/**
 * DEMO sağlayıcısı — yerel, yapılandırılmış JSON'dan okur (src/data/catalog/*).
 * Uygulama veri sözleşmesini (CatalogProvider) birebir uygular.
 */
import { LOCALES, SOLD_PRODUCTS, type Locale } from '../../../config/site';
import productsJson from '../../../data/catalog/products.json';
import categoriesJson from '../../../data/catalog/categories.json';
import imagesJson from '../../../data/catalog/images.json';
import editorialJson from '../../../data/editorial.json';
import { indexProduct, runQuery, type IndexedProduct } from '../../catalog-engine';
import { dict, withBase } from '../../../i18n';
import type {
  Cart, CartLine, CartLineInput, CartWarning, CatalogProvider, Category, Editorial, Product, ProductAttributes, ProductImage, ProductQuery, RequestContext,
} from '../types';

interface RawProduct {
  id: string; handle: string; sku: string | null; sourceTitle: string; categories: string[]; primaryCategory: string; categoryPath: string[];
  attributes: ProductAttributes; notes: string[]; price: { amount: number; currencyCode: 'TRY' }; sourceStock: string; sourceOrder: number;
  isNew: boolean; sourceImageUrls: string[]; sourceUrl: string; demoSold: boolean; title: Record<Locale, string>; description: Record<Locale, string>;
}
interface RawCategory { handle: string; parent: string | null; title: Record<Locale, string>; children: string[]; order: number; path: string[]; productCount: number; source: string | null }
type RawImages = Record<string, Array<{ n: number; source: string; width: number; height: number; files: Record<string, { file: string; width: number; height: number }> }>>;

const RAW_PRODUCTS = productsJson as unknown as RawProduct[];
const RAW_CATEGORIES = categoriesJson as unknown as RawCategory[];
const RAW_IMAGES = imagesJson as unknown as RawImages;
const CAT_BY_HANDLE = new Map(RAW_CATEGORIES.map((c) => [c.handle, c]));

/** Demo stok: kaynakta tüm ürünler "Var" idi. demoSold alt kümesi satıldı davranışını göstermek içindir. */
const DEMO_QUANTITY = 1;

function imageRole(src: string): ProductImage['role'] {
  const f = decodeURIComponent(src).toLocaleLowerCase('tr');
  if (/(^|[-_/ ])(ön|on|front)([-_. ]|$)/.test(f)) return 'obverse';
  if (/arka|back/.test(f)) return 'reverse';
  return 'other';
}

function buildProduct(r: RawProduct, locale: Locale): Product {
  const d = dict(locale).product;
  const title = r.title[locale] || r.title.tr;
  const imgs = (RAW_IMAGES[r.handle] ?? []).map((im, i): ProductImage => {
    const role = imageRole(im.source);
    const big = im.files['640'], small = im.files['320'];
    const label = role === 'obverse' ? d.obverse : role === 'reverse' ? d.reverse : `${d.image} ${i + 1}`;
    return { url: withBase(big.file), thumbUrl: withBase(small.file), width: big.width, height: big.height, alt: `${title} — ${label}`, role };
  });
  const catRefs = r.categories.map((h) => ({ handle: h, path: CAT_BY_HANDLE.get(h)?.path ?? [h] }));
  return {
    id: r.id,
    handle: r.handle,
    variantId: `${r.id}-v1`,
    sku: r.sku ?? undefined,
    title,
    description: r.description[locale] || r.description.tr,
    categories: catRefs,
    primaryCategory: { handle: r.primaryCategory, path: r.categoryPath },
    attributes: r.attributes,
    images: imgs,
    price: { amount: r.price.amount, currencyCode: 'TRY' },
    available: !r.demoSold,
    quantityAvailable: r.demoSold ? 0 : DEMO_QUANTITY,
    newness: r.sourceOrder,
    isNew: r.isNew,
    tags: [r.isNew ? 'yeni' : '', r.demoSold ? 'demo-satildi' : ''].filter(Boolean),
    source: { url: r.sourceUrl, imageUrls: r.sourceImageUrls },
    isDemo: true,
  };
}

// Dil başına bir kez oluşturulan, bellekte tutulan dizin
const cache = new Map<Locale, { list: IndexedProduct[]; byHandle: Map<string, Product> }>();
function catalogFor(locale: Locale) {
  let c = cache.get(locale);
  if (!c) {
    const list = RAW_PRODUCTS.map((r) => {
      const p = buildProduct(r, locale);
      return indexProduct(p, searchExtra(r));
    });
    c = { list, byHandle: new Map(list.map((ix) => [ix.product.handle, ix.product])) };
    cache.set(locale, c);
  }
  return c;
}

/** Arama için ek metin: diğer dillerdeki başlıklar, ülke/kategori adları, malzeme eş anlamlıları. İstemci dizini de bunu kullanır. */
export function searchExtra(r: RawProduct): string {
  return [
    ...LOCALES.map((l) => r.title[l]), r.sourceTitle,
    ...r.categoryPath.flatMap((h) => LOCALES.map((l) => CAT_BY_HANDLE.get(h)?.title[l] ?? '')),
    r.attributes.country ? LOCALES.map((l) => CAT_BY_HANDLE.get(r.attributes.country!)?.title[l] ?? '').join(' ') : '',
    r.attributes.material ? MATERIAL_WORDS[r.attributes.material] ?? '' : '',
    r.attributes.country === 'osmanli-imparatorlugu' ? 'osmanlı ottoman オスマン османская' : '',
    r.attributes.country === 'turkiye' ? 'türkiye turkey turkiye トルコ турция cumhuriyet' : '',
  ].join(' ');
}

const RAW_BY_HANDLE = new Map(RAW_PRODUCTS.map((r) => [r.handle, r]));
export function searchExtraFor(handle: string): string {
  const r = RAW_BY_HANDLE.get(handle);
  return r ? searchExtra(r) : '';
}

const MATERIAL_WORDS: Record<string, string> = {
  silver: 'gümüş silver 銀 серебро серебряная', gold: 'altın gold 金 золото', bronze: 'bronz bronze 青銅 бронза', brass: 'pirinç brass 黄銅 латунь',
  nickel: 'nikel nickel ニッケル никель', bimetal: 'bimetal bimetallic バイメタル биметалл',
};

function descendants(handle: string): Set<string> {
  const out = new Set<string>([handle]);
  const stack = [handle];
  while (stack.length) {
    const h = stack.pop()!;
    for (const ch of CAT_BY_HANDLE.get(h)?.children ?? []) if (!out.has(ch)) { out.add(ch); stack.push(ch); }
  }
  return out;
}

export function createDemoProvider(): CatalogProvider {
  return {
    name: 'demo',
    async getCategories() {
      return RAW_CATEGORIES.map((c): Category => ({
        handle: c.handle, parent: c.parent ?? undefined, path: c.path, title: c.title, children: c.children, productCount: c.productCount, order: c.order,
      }));
    },
    async getProduct(handle, ctx) {
      const p = catalogFor(ctx.locale).byHandle.get(handle);
      if (!p) return null;
      if (!p.available && !SOLD_PRODUCTS.keepSoldProductPages) return null;
      return p;
    },
    async listProducts(query: ProductQuery, ctx: RequestContext) {
      const { list } = catalogFor(ctx.locale);
      const categoryHandles = query.category ? descendants(query.category) : undefined;
      return runQuery(list, query, { categoryHandles });
    },
    async getProductsByHandles(handles, ctx) {
      const m = catalogFor(ctx.locale).byHandle;
      return handles.map((h) => m.get(h)).filter((p): p is Product => !!p);
    },
    async listAllProductHandles() {
      // Demo verisinde gerçek güncelleme tarihi yok → lastmod üretilmez
      return RAW_PRODUCTS.filter((r) => SOLD_PRODUCTS.keepSoldProductPages || !r.demoSold).map((r) => ({ handle: r.handle }));
    },
    async syncCart(lines: CartLineInput[], ctx: RequestContext): Promise<Cart> {
      const m = catalogFor(ctx.locale).byHandle;
      const warnings: CartWarning[] = [];
      const out: CartLine[] = [];
      for (const l of lines) {
        const p = m.get(l.handle);
        if (!p) { warnings.push({ type: 'not-found', handle: l.handle }); continue; }
        let qty = Math.max(1, Math.floor(l.quantity || 1));
        if (!p.available) warnings.push({ type: 'sold-out', handle: p.handle });
        else if (p.quantityAvailable != null && qty > p.quantityAvailable) {
          qty = p.quantityAvailable;
          warnings.push({ type: 'quantity-reduced', handle: p.handle, available: qty });
        }
        if (l.seenPrice != null && Math.abs(l.seenPrice - p.price.amount) > 0.001) {
          warnings.push({ type: 'price-changed', handle: p.handle, from: l.seenPrice, to: p.price.amount });
        }
        out.push({
          variantId: p.variantId, handle: p.handle, quantity: qty, product: p, available: p.available,
          unitPrice: p.price, lineTotal: { amount: p.available ? p.price.amount * qty : 0, currencyCode: p.price.currencyCode },
        });
      }
      const subtotal = out.reduce((s, l) => s + l.lineTotal.amount, 0);
      return { lines: out, subtotal: { amount: subtotal, currencyCode: 'TRY' }, warnings };
    },
    async getEditorial(): Promise<Editorial> {
      const { _note, ...e } = editorialJson as Editorial & { _note?: string };
      return e;
    },
  };
}
