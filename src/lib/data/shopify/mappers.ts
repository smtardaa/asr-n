/** Shopify Storefront yanıtlarını uygulama veri sözleşmesine dönüştürür (saf fonksiyonlar — testlerde kullanılır). */
import type { CurrencyCode } from '../../../config/site';
import type { Cart, CartLine, Category, Money, Product, ProductAttributes, ProductImage } from '../types';

export interface SfMoney { amount: string; currencyCode: string }
export interface SfImage { url: string; altText: string | null; width: number | null; height: number | null }
export interface SfMetafield { key: string; value: string; type: string }
export interface SfProduct {
  id: string; handle: string; title: string; description: string; availableForSale: boolean; createdAt: string; updatedAt: string;
  tags: string[]; productType: string; seo?: { title: string | null; description: string | null };
  featuredImage: SfImage | null; images: { nodes: SfImage[] };
  variants: { nodes: Array<{ id: string; sku: string | null; availableForSale: boolean; quantityAvailable: number | null; price: SfMoney }> };
  collections: { nodes: Array<{ handle: string }> };
  metafields: Array<SfMetafield | null>;
}
export interface SfCollection {
  handle: string; title: string; description: string; image: SfImage | null;
  parent: { reference: { handle: string } | null } | null; sortOrder: { value: string } | null;
}
export interface SfCart {
  id: string; checkoutUrl: string; totalQuantity: number;
  cost: { subtotalAmount: SfMoney; totalAmount: SfMoney };
  lines: { nodes: Array<{ id: string; quantity: number; cost: { amountPerQuantity: SfMoney; totalAmount: SfMoney }; merchandise: { id: string; availableForSale: boolean; quantityAvailable: number | null; product: { handle: string } } }> };
}

export const money = (m: SfMoney): Money => ({ amount: Number(m.amount), currencyCode: m.currencyCode as CurrencyCode });

export function mapAttributes(mfs: Array<SfMetafield | null>): ProductAttributes {
  const m = new Map(mfs.filter((x): x is SfMetafield => !!x && x.value !== '').map((x) => [x.key, x.value]));
  const num = (k: string) => (m.has(k) && Number.isFinite(Number(m.get(k))) ? Number(m.get(k)) : undefined);
  const a: ProductAttributes = {
    country: m.get('country'), period: m.get('period'), emission: m.get('emission'), tertip: m.get('tertip'), ruler: m.get('ruler'),
    yearFrom: num('year_from'), yearTo: num('year_to') ?? num('year_from'), yearText: m.get('year_text') ?? (num('year_from') ? String(num('year_from')) : undefined),
    denomination: num('denomination'), denominationText: m.get('denomination_text'), unit: m.get('unit'), condition: m.get('condition'),
    catalogNumber: m.get('catalog_number'), material: m.get('material'),
    certification: m.get('certification_authority') ? { authority: m.get('certification_authority')!, grade: m.get('certification_grade') } : undefined,
    productType: m.get('product_type') as ProductAttributes['productType'],
  };
  // undefined alanları at (arayüzde boş satır üretmemek için)
  return Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as ProductAttributes;
}

export function mapImage(img: SfImage, fallbackAlt: string, i: number): ProductImage {
  const sized = (w: number) => `${img.url}${img.url.includes('?') ? '&' : '?'}width=${w}`;
  return {
    url: sized(1000), thumbUrl: sized(400), width: img.width ?? 1000, height: img.height ?? 1000,
    alt: img.altText || `${fallbackAlt} — ${i + 1}`, role: i === 0 ? 'obverse' : i === 1 ? 'reverse' : 'other',
  };
}

export function mapProduct(p: SfProduct, collectionPaths: Map<string, string[]>): Product {
  const v = p.variants.nodes[0];
  const cats = p.collections.nodes.map((c) => ({ handle: c.handle, path: collectionPaths.get(c.handle) ?? [c.handle] }));
  const primary = [...cats].sort((a, b) => b.path.length - a.path.length)[0];
  const isDemo = p.metafields.some((m) => m?.key === 'is_demo' && m.value === 'true');
  return {
    id: p.id,
    handle: p.handle,
    variantId: v?.id ?? '',
    sku: v?.sku ?? undefined,
    title: p.title,
    description: p.description,
    categories: cats,
    primaryCategory: primary,
    attributes: mapAttributes(p.metafields),
    images: p.images.nodes.map((img, i) => mapImage(img, p.title, i)),
    price: v ? money(v.price) : { amount: 0, currencyCode: 'TRY' },
    // Satıldı = ürün yayında ama satılabilir varyantı yok
    available: !!(p.availableForSale && v?.availableForSale),
    quantityAvailable: v?.quantityAvailable ?? undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    newness: Date.parse(p.createdAt) || 0,
    isNew: p.tags.includes('yeni'),
    tags: p.tags,
    isDemo,
  };
}

export function mapCollections(nodes: SfCollection[]): Category[] {
  const parentOf = new Map(nodes.map((c) => [c.handle, c.parent?.reference?.handle]));
  const pathOf = (h: string): string[] => {
    const out: string[] = [];
    let cur: string | undefined = h;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) { seen.add(cur); out.unshift(cur); cur = parentOf.get(cur); }
    return out;
  };
  return nodes.map((c) => ({
    handle: c.handle,
    parent: parentOf.get(c.handle),
    path: pathOf(c.handle),
    title: c.title,
    description: c.description,
    image: c.image ? mapImage(c.image, c.title, 0) : undefined,
    children: nodes.filter((x) => parentOf.get(x.handle) === c.handle).map((x) => x.handle),
    productCount: 0,
    order: Number(c.sortOrder?.value ?? 999),
  }));
}

export function mapCart(c: SfCart, products: Map<string, Product>): Cart {
  const lines: CartLine[] = c.lines.nodes.map((l) => ({
    lineId: l.id,
    variantId: l.merchandise.id,
    handle: l.merchandise.product.handle,
    quantity: l.quantity,
    product: products.get(l.merchandise.product.handle),
    unitPrice: money(l.cost.amountPerQuantity),
    lineTotal: money(l.cost.totalAmount),
    available: l.merchandise.availableForSale,
  }));
  return { id: c.id, lines, subtotal: money(c.cost.subtotalAmount), total: money(c.cost.totalAmount), checkoutUrl: c.checkoutUrl, warnings: [] };
}
