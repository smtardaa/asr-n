/**
 * MERKEZİ AYARLAR — işletme bilgileri, diller, para birimi eşlemesi, demo kur ve vitrin davranışları.
 * Gizli değerler burada TUTULMAZ (bkz. .env / src/lib/env.ts). Bu dosya istemciye gönderilebilir.
 */

export const LOCALES = ['tr', 'en', 'ja', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

/** Dil seçicide görünen adlar (her dil kendi adıyla). */
export const LOCALE_LABELS: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  ja: '日本語',
  ru: 'Русский',
};

/** HTML lang / hreflang / Intl yerel ayarı */
export const LOCALE_TAGS: Record<Locale, { html: string; hreflang: string; intl: string; og: string }> = {
  tr: { html: 'tr', hreflang: 'tr', intl: 'tr-TR', og: 'tr_TR' },
  en: { html: 'en', hreflang: 'en', intl: 'en-US', og: 'en_US' },
  ja: { html: 'ja', hreflang: 'ja', intl: 'ja-JP', og: 'ja_JP' },
  ru: { html: 'ru', hreflang: 'ru', intl: 'ru-RU', og: 'ru_RU' },
};

export type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'JPY' | 'RUB';

/**
 * Fiyatlandırma.
 * - baseCurrency: Katalog fiyatlarının kaydedildiği para birimi (Shopify mağaza para birimi de TRY olmalı).
 * - displayCurrencyByLocale: DEMO modunda her dilin gösterim para birimi. ja ve ru için USD geçici tercihtir.
 * - demoRates: 1 birim yabancı para = kaç TRY. CANLI PİYASA KURU DEĞİLDİR; yalnızca demo gösterimi içindir.
 * Canlı (shopify) modda fiyatlar Shopify pazar bağlamından (@inContext) gelir; bu kurlar kullanılmaz.
 */
export const PRICING = {
  baseCurrency: 'TRY' as CurrencyCode,
  displayCurrencyByLocale: {
    tr: 'TRY',
    en: 'USD',
    ja: 'USD',
    ru: 'USD',
  } satisfies Record<Locale, CurrencyCode>,
  demoRates: {
    TRY: 1,
    USD: 48,
  } as Partial<Record<CurrencyCode, number>>,
  /** Para birimi başına gösterim ondalığı (tutarlı yuvarlama: yarım değerler sıfırdan uzağa) */
  fractionDigits: { TRY: 2, USD: 2, EUR: 2, JPY: 0, RUB: 2 } satisfies Record<CurrencyCode, number>,
};

/**
 * Canlı modda dil ≠ pazar ≠ para birimi. Her dil için Shopify'a gönderilecek varsayılan ülke (@inContext country)
 * ve dil (@inContext language) burada eşlenir. Ziyaretçinin ülkesi daha sonra ayrı bir pazar seçiciyle
 * değiştirilebilir; dil değişimi tek başına ödeme para birimini DEĞİŞTİRMEZ.
 */
export const SHOPIFY_CONTEXT: Record<Locale, { language: string; country: string }> = {
  tr: { language: 'TR', country: 'TR' },
  en: { language: 'EN', country: 'TR' },
  ja: { language: 'JA', country: 'TR' },
  ru: { language: 'RU', country: 'TR' },
};

/**
 * SATILAN ÜRÜN DAVRANIŞI — tek merkezden yönetilir.
 * - keepSoldProductPages: Stoku biten ürün kendi URL'sinde "Satıldı" etiketiyle kalır (false → 404/410 döner).
 * - showSoldInListings: Satılan ürünler varsayılan listelerde görünsün mü (false → yalnızca "Satılanlar" arşivinde ve
 *   "Satıldı" filtresi seçilince görünür).
 * - soldHttpStatus: Satılan ürün sayfasının HTTP durumu (200 önerilir; sayfa indekslenebilir kalır).
 */
export const SOLD_PRODUCTS = {
  keepSoldProductPages: true,
  showSoldInListings: false,
  soldHttpStatus: 200,
  similarAvailableCount: 4,
};

/**
 * İŞLETME BİLGİLERİ — DOLDURULACAK.
 * Boş bırakılan alanlar sitede "Doldurulacak" olarak görünür; boşken tel:, mailto:, WhatsApp veya harita bağlantısı üretilmez.
 * Yapılandırılmış veriye (JSON-LD) yalnızca dolu alanlar eklenir.
 */
export const BUSINESS = {
  brandName: 'ASRIN Koleksiyon & Antika',
  shortName: 'ASRIN',
  legalName: '', // Ticari unvan
  taxOffice: '', // Vergi dairesi
  taxNumber: '', // Vergi numarası
  mersisNumber: '', // MERSİS no
  phone: '', // +90 ile, örn. +905551112233
  whatsapp: '', // Uluslararası biçimde, yalnızca rakam, örn. 905551112233
  email: '',
  address: '', // Açık adres
  mapUrl: '', // Harita bağlantısı (Google Maps vb.)
  workingHours: '',
  history: '', // İşletme geçmişi (doğrulanmış bilgiyle doldurulacak)
  social: {
    instagram: '',
    facebook: '',
    x: '',
    youtube: '',
  },
};

/** KARGO / İADE — DOLDURULACAK. Boşken sitede kesin koşul yazılmaz. */
export const COMMERCE_POLICIES = {
  shippingCarrier: '',
  shippingFee: '',
  shippingTime: '',
  freeShippingThreshold: '', // Boş = ücretsiz kargo vaadi gösterilmez
  returnPolicy: '',
  cancellationPolicy: '',
};

/** Ürün listeleme */
export const CATALOG = {
  pageSize: 24,
  newArrivalsCount: 48,
  homeNewArrivals: 8,
};

/** Ana kategori sırası (handle). Antika ve Madalya/Obje ikincil konumdadır. */
export const ROOT_CATEGORY_ORDER = [
  't-c-kagit-paralar',
  't-c-madeni-paralar',
  't-c-hatira-paralar',
  'osmanli-paralari',
  'yabanci-paralar',
  'sertifikali-paralar',
  'pul',
  'koleksiyon-malzemeleri',
  'madalya-ve-objeler',
  'antika',
] as const;
