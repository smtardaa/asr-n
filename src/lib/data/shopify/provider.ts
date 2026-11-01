/**
 * SHOPIFY sağlayıcısı — Storefront API (Cart API) üzerinden ürün, koleksiyon, fiyat, stok ve sepet.
 * Hata durumunda DataSourceError fırlatır; demo verisine SESSİZCE DÖNMEZ.
 *
 * Önbellek politikası:
 *  - Ürün detayı (getProduct) ve sepet (syncCart): her istekte canlı sorgu, önbellek yok.
 *  - Liste/arama dizini ve koleksiyonlar: SHOPIFY_CATALOG_CACHE_TTL saniye (varsayılan 300) bellek içi önbellek.
 *    Geçersiz kılma: Shopify webhook (POST /api/shopify/webhook) veya POST /api/revalidate.
 */
import { SHOPIFY_CONTEXT, SOLD_PRODUCTS } from '../../../config/site';
import { serverEnv } from '../../env';
import { indexProduct, runQuery, type IndexedProduct } from '../../catalog-engine';
import { cached, storefront } from './client';
import * as Q from './queries';
import { mapCart, mapCollections, mapProduct, type SfCart, type SfCollection, type SfProduct } from './mappers';
import { DataSourceError, type Cart, type CartLineInput, type CartWarning, type CatalogProvider, type Category, type Editorial, type Product, type RequestContext } from '../types';

const ctxVars = (ctx: RequestContext) => ({ country: SHOPIFY_CONTEXT[ctx.locale].country, language: SHOPIFY_CONTEXT[ctx.locale].language });

async function loadCollections(ctx: RequestContext): Promise<Category[]> {
  const ttl = serverEnv().shopify.cacheTtl;
  return cached(`collections:${ctx.locale}`, ttl, async () => {
    const nodes: SfCollection[] = [];
    let cursor: string | null = null;
    do {
      const d: { collections: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: SfCollection[] } } =
        await storefront(Q.COLLECTIONS, { cursor, language: SHOPIFY_CONTEXT[ctx.locale].language }, { buyerIp: ctx.buyerIp });
      nodes.push(...d.collections.nodes);
      cursor = d.collections.pageInfo.hasNextPage ? d.collections.pageInfo.endCursor : null;
    } while (cursor);
    return mapCollections(nodes);
  });
}

async function loadIndex(ctx: RequestContext): Promise<IndexedProduct[]> {
  const ttl = serverEnv().shopify.cacheTtl;
  return cached(`index:${ctx.locale}`, ttl, async () => {
    const cats = await loadCollections(ctx);
    const paths = new Map(cats.map((c) => [c.handle, c.path]));
    const titles = new Map(cats.map((c) => [c.handle, typeof c.title === 'string' ? c.title : c.title[ctx.locale]]));
    const out: IndexedProduct[] = [];
    let cursor: string | null = null;
    let guard = 0;
    do {
      const d: { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: SfProduct[] } } =
        await storefront(Q.PRODUCTS_PAGE, { cursor, ...ctxVars(ctx) }, { buyerIp: ctx.buyerIp, timeoutMs: 20000 });
      for (const n of d.products.nodes) {
        const p = mapProduct(n, paths);
        const extra = [...p.categories.flatMap((c) => c.path.map((h) => titles.get(h) ?? '')), n.productType, n.tags.join(' ')].join(' ');
        out.push(indexProduct(p, extra));
      }
      cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
      if (++guard > 80) throw new DataSourceError('Ürün dizini 20.000 ürün sınırını aştı; dizin modu yerine Shopify arama API’sine geçilmeli.', 'api');
    } while (cursor);
    return out;
  });
}

function descendants(cats: Category[], handle: string): Set<string> {
  const out = new Set([handle]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats) if (c.parent && out.has(c.parent) && !out.has(c.handle)) { out.add(c.handle); grew = true; }
  }
  return out;
}

export function createShopifyProvider(): CatalogProvider {
  return {
    name: 'shopify',
    async getCategories(ctx) {
      const [cats, index] = await Promise.all([loadCollections(ctx), loadIndex(ctx)]);
      return cats.map((c) => {
        const set = descendants(cats, c.handle);
        const count = index.filter((ix) => ix.product.categories.some((pc) => set.has(pc.handle))).length;
        return { ...c, productCount: count };
      });
    },
    async getProduct(handle, ctx) {
      const d = await storefront<{ product: SfProduct | null }>(Q.PRODUCT_BY_HANDLE, { handle, ...ctxVars(ctx) }, { buyerIp: ctx.buyerIp });
      if (!d.product) return null; // arşivlenmiş / yayından kaldırılmış ürün → 404
      const cats = await loadCollections(ctx);
      const p = mapProduct(d.product, new Map(cats.map((c) => [c.handle, c.path])));
      if (!p.available && !SOLD_PRODUCTS.keepSoldProductPages) return null;
      return p;
    },
    async listProducts(query, ctx) {
      const [index, cats] = await Promise.all([loadIndex(ctx), query.category ? loadCollections(ctx) : Promise.resolve([] as Category[])]);
      return runQuery(index, query, { categoryHandles: query.category ? descendants(cats, query.category) : undefined });
    },
    async getProductsByHandles(handles, ctx) {
      const index = await loadIndex(ctx);
      const m = new Map(index.map((ix) => [ix.product.handle, ix.product]));
      return handles.map((h) => m.get(h)).filter((p): p is Product => !!p);
    },
    async listAllProductHandles(ctx) {
      const index = await loadIndex(ctx);
      return index
        .filter((ix) => SOLD_PRODUCTS.keepSoldProductPages || ix.product.available)
        .map((ix) => ({ handle: ix.product.handle, updatedAt: ix.product.updatedAt }));
    },
    async syncCart(lines: CartLineInput[], ctx: RequestContext, cartId?: string): Promise<Cart> {
      const vars = ctxVars(ctx);
      const index = await loadIndex(ctx);
      const byHandle = new Map(index.map((ix) => [ix.product.handle, ix.product]));
      const opt = { buyerIp: ctx.buyerIp };
      type R = { cart: SfCart | null; userErrors?: Array<{ message: string }> };
      const check = (r: R | undefined, label: string): SfCart => {
        if (!r?.cart) throw new DataSourceError(`${label}: ${r?.userErrors?.map((e) => e.message).join('; ') || 'sepet yok'}`, 'api');
        return r.cart;
      };
      const wanted = lines.filter((l) => l.variantId && l.quantity > 0);
      let cart: SfCart | null = null;
      if (cartId) {
        const d = await storefront<{ cart: SfCart | null }>(Q.CART_QUERY, { id: cartId, ...vars }, opt);
        cart = d.cart; // süresi dolmuş/geçersiz sepet → null → yeniden oluştur
      }
      if (!cart) {
        const d = await storefront<{ cartCreate: R }>(Q.CART_CREATE, {
          input: { lines: wanted.map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity })), buyerIdentity: { countryCode: vars.country } }, ...vars,
        }, opt);
        cart = check(d.cartCreate, 'cartCreate');
      } else {
        // Uzlaştırma: kaldırılan, değişen ve yeni satırlar
        const existing = new Map(cart.lines.nodes.map((n) => [n.merchandise.id, n]));
        const wantIds = new Set(wanted.map((l) => l.variantId));
        const remove = cart.lines.nodes.filter((n) => !wantIds.has(n.merchandise.id)).map((n) => n.id);
        const update = wanted.filter((l) => existing.has(l.variantId) && existing.get(l.variantId)!.quantity !== l.quantity)
          .map((l) => ({ id: existing.get(l.variantId)!.id, quantity: l.quantity }));
        const add = wanted.filter((l) => !existing.has(l.variantId)).map((l) => ({ merchandiseId: l.variantId, quantity: l.quantity }));
        if (remove.length) cart = check((await storefront<{ cartLinesRemove: R }>(Q.CART_LINES_REMOVE, { cartId: cart.id, lineIds: remove, ...vars }, opt)).cartLinesRemove, 'cartLinesRemove');
        if (update.length) cart = check((await storefront<{ cartLinesUpdate: R }>(Q.CART_LINES_UPDATE, { cartId: cart.id, lines: update, ...vars }, opt)).cartLinesUpdate, 'cartLinesUpdate');
        if (add.length) cart = check((await storefront<{ cartLinesAdd: R }>(Q.CART_LINES_ADD, { cartId: cart.id, lines: add, ...vars }, opt)).cartLinesAdd, 'cartLinesAdd');
      }
      const out = mapCart(cart, byHandle);
      const warnings: CartWarning[] = [];
      for (const l of wanted) {
        const line = out.lines.find((x) => x.variantId === l.variantId);
        if (!line) { warnings.push({ type: byHandle.has(l.handle) ? 'sold-out' : 'not-found', handle: l.handle }); continue; }
        if (!line.available) warnings.push({ type: 'sold-out', handle: l.handle });
        else if (line.quantity < l.quantity) warnings.push({ type: 'quantity-reduced', handle: l.handle, available: line.quantity });
        if (l.seenPrice != null && Math.abs(l.seenPrice - line.unitPrice.amount) > 0.001) warnings.push({ type: 'price-changed', handle: l.handle, from: l.seenPrice, to: line.unitPrice.amount });
      }
      out.warnings = warnings;
      return out;
    },
    async getEditorial(ctx): Promise<Editorial> {
      const ttl = serverEnv().shopify.cacheTtl;
      return cached(`home:${ctx.locale}`, ttl, async () => {
        type F = { key: string; value: string; references?: { nodes: Array<{ handle?: string }> } | null; reference?: { handle?: string } | null };
        const d = await storefront<{ metaobject: { fields: F[] } | null }>(Q.HOME_METAOBJECT, { language: SHOPIFY_CONTEXT[ctx.locale].language }, { buyerIp: ctx.buyerIp });
        if (!d.metaobject) throw new DataSourceError('Ana sayfa metaobject’i (asrin_home / home) bulunamadı.', 'config');
        const f = new Map(d.metaobject.fields.map((x) => [x.key, x]));
        const list = (k: string) => (f.get(k)?.references?.nodes ?? []).map((n) => n.handle).filter((h): h is string => !!h);
        const one = (k: string) => f.get(k)?.reference?.handle ?? '';
        let catImages: Record<string, string> = {};
        try { catImages = JSON.parse(f.get('category_images')?.value || '{}'); } catch { /* boş */ }
        return {
          heroProductHandles: list('hero_products'),
          featuredCategoryHandles: list('featured_collections'),
          categoryImageHandles: catImages,
          ottomanFeatureCategory: one('ottoman_collection') || 'osmanli-paralari',
          ottomanFeatureProduct: one('ottoman_product') || undefined,
          foreignFeatureCategory: one('foreign_collection') || 'yabanci-paralar',
          foreignFeatureProducts: list('foreign_products'),
          antiqueCategory: one('antique_collection') || 'antika',
        };
      });
    },
  };
}
