/**
 * UYGULAMA VERİ SÖZLEŞMESİ
 * Demo ve Shopify sağlayıcıları aynı tipleri döndürür. Sayfalar yalnızca bu sözleşmeye bağımlıdır.
 */
import type { CurrencyCode, Locale } from '../../config/site';

export interface Money {
  /** Sayısal tutar (metin değil) */
  amount: number;
  currencyCode: CurrencyCode;
}

export interface ProductImage {
  /** Uygulama içi veya CDN adresi */
  url: string;
  /** Küçük boyut (liste kartları) */
  thumbUrl?: string;
  width: number;
  height: number;
  alt: string;
  /** Görselin yüzü: ön, arka, diğer */
  role?: 'obverse' | 'reverse' | 'other';
}

/** Numizmatik / koleksiyon özellikleri. Kaynakta olmayan alan boş (undefined) kalır. */
export interface ProductAttributes {
  country?: string; // ülke kodu (src/i18n/countries.ts anahtarı) ya da serbest metin
  period?: string; // dönem (ör. 1924-1957)
  emission?: string; // emisyon (ör. "7")
  ruler?: string; // hükümdar
  yearFrom?: number;
  yearTo?: number;
  yearText?: string; // kaynakta yazıldığı biçim (ör. "1944/47")
  denomination?: number; // nominal değer
  denominationText?: string; // ör. "1.000.000"
  unit?: string; // birim (ör. "Lira", "Mark")
  condition?: string; // ör. "10/10", "PMG 45"
  conditionGrade?: 'unc' | 'aunc' | 'xf' | 'vf' | 'f' | 'certified' | 'other';
  catalogNumber?: string; // ör. "P#134"
  material?: string; // metal / malzeme anahtarı (ör. "silver")
  certification?: { authority: string; grade?: string };
  productType?: 'banknote' | 'coin' | 'stamp' | 'accessory' | 'medal' | 'antique' | 'set';
  tertip?: string; // tertip / seri
}

export interface CategoryRef {
  handle: string;
  path: string[]; // kökten itibaren handle yolu
}

export interface Product {
  id: string; // sabit kimlik (Shopify: gid://shopify/Product/..., demo: asrin-demo-####)
  handle: string; // slug
  variantId: string; // satın alınabilir varyant
  sku?: string; // ürün kodu
  title: string; // dile göre
  description: string; // dile göre düz metin
  categories: CategoryRef[];
  primaryCategory?: CategoryRef;
  attributes: ProductAttributes;
  images: ProductImage[];
  price: Money; // mağaza (base) para biriminde
  available: boolean; // satılabilir mi
  quantityAvailable?: number; // biliniyorsa
  createdAt?: string; // ISO — yalnızca gerçek veri (demo'da yok)
  /** "Yeni eklenenler" sıralaması için sayısal anahtar (büyük = yeni). Demo: kaynak ürün sırası; Shopify: createdAt. */
  newness: number;
  isNew?: boolean;
  updatedAt?: string; // ISO — yalnızca gerçek güncelleme verisi
  tags: string[];
  source?: { url: string; imageUrls: string[] }; // demo: kaynak kaydı
  isDemo: boolean;
}

export interface Category {
  handle: string;
  parent?: string;
  path: string[];
  title: Record<Locale, string> | string; // demo: çok dilli; shopify: dile göre gelen başlık
  description?: string;
  image?: ProductImage;
  children: string[];
  productCount: number; // doğrulanmış ürün sayısı (alt kategoriler dahil)
  order: number;
}

export type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'name' | 'relevance';
export type StockFilter = 'available' | 'sold' | 'all';

export interface ProductQuery {
  q?: string;
  category?: string; // handle (alt kategoriler dahil)
  countries?: string[];
  yearFrom?: number;
  yearTo?: number;
  denominations?: string[]; // "100|lira" biçiminde normalize anahtar
  conditions?: string[];
  materials?: string[];
  certification?: string[]; // otorite (PMG, PCGS, NGC...)
  priceMin?: number; // gösterim para biriminde değil, base (TRY) cinsinden
  priceMax?: number;
  stock?: StockFilter;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  pageCount: number;
  facets: {
    countries: FacetValue[];
    years: { min?: number; max?: number };
    denominations: FacetValue[];
    conditions: FacetValue[];
    materials: FacetValue[];
    certification: FacetValue[];
    price: { min?: number; max?: number };
    stock: { available: number; sold: number };
  };
}

export interface CartLineInput {
  variantId: string;
  handle: string;
  quantity: number;
  /** Sepete eklendiği andaki fiyat (değişiklik uyarısı için) */
  seenPrice?: number;
}

export type CartWarning =
  | { type: 'sold-out'; handle: string }
  | { type: 'quantity-reduced'; handle: string; available: number }
  | { type: 'price-changed'; handle: string; from: number; to: number }
  | { type: 'not-found'; handle: string };

export interface CartLine {
  lineId?: string; // shopify cart line id
  variantId: string;
  handle: string;
  quantity: number;
  product?: Product;
  unitPrice: Money;
  lineTotal: Money;
  available: boolean;
}

export interface Cart {
  id?: string; // shopify cart id
  lines: CartLine[];
  subtotal: Money;
  total?: Money; // shopify: vergi/indirim sonrası tahmini toplam
  checkoutUrl?: string; // yalnızca shopify
  warnings: CartWarning[];
}

export interface RequestContext {
  locale: Locale;
  buyerIp?: string;
}

export class DataSourceError extends Error {
  constructor(message: string, public readonly kind: 'config' | 'network' | 'api' = 'api', public readonly detail?: unknown) {
    super(message);
    this.name = 'DataSourceError';
  }
}

export interface CatalogProvider {
  readonly name: 'demo' | 'shopify';
  getCategories(ctx: RequestContext): Promise<Category[]>;
  getProduct(handle: string, ctx: RequestContext): Promise<Product | null>;
  listProducts(query: ProductQuery, ctx: RequestContext): Promise<ProductListResult>;
  getProductsByHandles(handles: string[], ctx: RequestContext): Promise<Product[]>;
  /** Sitemap için: tüm yayımlanmış ürünlerin handle + gerçek updatedAt bilgisi */
  listAllProductHandles(ctx: RequestContext): Promise<Array<{ handle: string; updatedAt?: string }>>;
  /** Sepeti güncel fiyat/stokla doğrular (ve shopify'da senkronlar). */
  syncCart(lines: CartLineInput[], ctx: RequestContext, cartId?: string): Promise<Cart>;
  /** Ana sayfa seçkileri (Shopify: metaobject/koleksiyon; demo: yerel JSON) */
  getEditorial(ctx: RequestContext): Promise<Editorial>;
}

export interface Editorial {
  heroProductHandles: string[];
  featuredCategoryHandles: string[];
  /** Kategori şeridi görseli için kategori → ürün handle eşlemesi */
  categoryImageHandles: Record<string, string>;
  ottomanFeatureCategory: string;
  ottomanFeatureProduct?: string;
  foreignFeatureCategory: string;
  foreignFeatureProducts: string[];
  antiqueCategory: string;
}
