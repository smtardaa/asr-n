# Shopify + PayTR bağlantı rehberi

> Durum (2026-11-02): Kod Shopify Storefront API **2026-10** sürümüne göre hazırlandı ve dönüştürücüler birim testleriyle
> doğrulandı. **Gerçek bir mağazaya karşı canlı test YAPILMADI** (hesap bilgisi yok). Aşağıdaki adımlar tamamlandıktan sonra
> "Canlı test kontrol listesi" uygulanmalıdır.

## 1. Hedef akış

```
Astro vitrin (SSR) ──Storefront API──▶ Shopify ürün/koleksiyon/fiyat/stok
        │
        └─ /api/cart/sync ─ Cart API (cartCreate / cartLinesAdd / cartLinesUpdate / cartLinesRemove)
                 │
                 └─ /api/cart/checkout ─ stok+fiyat yeniden doğrulanır ─▶ cart.checkoutUrl (Shopify checkout)
                                                                              │
                                                                              └─ PayTR Sanal POS (Shopify ödeme sağlayıcısı)
```

- Uygulama **ikinci bir ödeme sistemi yazmaz**; ödeme, sipariş ve iade Shopify + PayTR tarafında yürür.
- Eski Checkout API kullanılmaz; yalnızca Cart API ve `checkoutUrl`.

## 2. Shopify tarafında yapılacaklar

1. **Mağaza para birimi:** TRY. (Ürün fiyatları TRY girilir.)
2. **Headless satış kanalı** kurun (Shopify App Store → "Headless"). Bir storefront oluşturup **özel (private) erişim anahtarını** alın.
   - `.env` → `SHOPIFY_STORE_DOMAIN=<mağaza>.myshopify.com`, `SHOPIFY_STOREFRONT_PRIVATE_TOKEN=<anahtar>`
   - Anahtar yalnızca sunucuda, `Shopify-Storefront-Private-Token` başlığıyla kullanılır; ziyaretçi IP'si `Shopify-Storefront-Buyer-IP` ile iletilir.
   - Gerekli Storefront izinleri: ürün/koleksiyon okuma, **ürün envanteri okuma** (`unauthenticated_read_product_inventory` → `quantityAvailable`), sepet yazma/okuma, metaobject okuma.
3. **Ürünleri ve koleksiyonları Headless kanalında yayınlayın.**
4. **Diller:** Ayarlar → Diller: Türkçe (varsayılan), İngilizce, Japonca, Rusça. Çeviriler "Translate & Adapt" uygulamasıyla girilir;
   vitrin `@inContext(language: TR|EN|JA|RU)` ile ilgili çeviriyi alır.
5. **Pazarlar (Markets):** Başlangıçta yalnızca Türkiye pazarı (TRY). Vitrin her dil için `src/config/site.ts → SHOPIFY_CONTEXT` içindeki
   ülkeyi gönderir (varsayılan hepsi `TR`). Dil değişmesi ödeme para birimini **değiştirmez**. Yabancı para birimiyle tahsilat istenirse
   ilgili pazarlar Shopify'da açılır ve `SHOPIFY_CONTEXT` güncellenir; PayTR'nin o para birimini desteklediği ayrıca doğrulanmalıdır.

### 2.1 Ürün metafield'ları (namespace: `asrin`)

Admin → Ayarlar → Özel veriler → Ürünler. Her tanımda **"Storefront API erişimi" açık** olmalı.

| Uygulama alanı | Metafield anahtarı | Tür | Örnek |
|---|---|---|---|
| Ülke | `asrin.country` | Tek satır metin (koleksiyon handle'ı ile aynı, ör. `almanya`) | `almanya` |
| Dönem | `asrin.period` | Tek satır metin | `1924–1957` |
| Emisyon | `asrin.emission` | Tek satır metin | `5` |
| Tertip / seri | `asrin.tertip` | Tek satır metin | `3` |
| Hükümdar | `asrin.ruler` | Tek satır metin (hükümdar koleksiyon handle'ı) | `v-mehmed-resad` |
| Yıl (başlangıç/bitiş) | `asrin.year_from`, `asrin.year_to` | Tamsayı | `1944`, `1947` |
| Yıl (gösterim) | `asrin.year_text` | Tek satır metin (Hicrî için `H1327/4`) | `1944–1947` |
| Nominal değer | `asrin.denomination` | Ondalık | `2.5` |
| Nominal (gösterim) | `asrin.denomination_text` | Tek satır metin | `2 ½` |
| Birim | `asrin.unit` | Tek satır metin (`src/data/catalog/units.json` anahtarı) | `lira` |
| Kondisyon | `asrin.condition` | Tek satır metin | `10/9,5` · `PMG 58` |
| Katalog no | `asrin.catalog_number` | Tek satır metin | `P-134` |
| Metal / malzeme | `asrin.material` | Tek satır metin: `silver` `gold` `bronze` `brass` `nickel` `bimetal` | `silver` |
| Sertifika kurumu / derece | `asrin.certification_authority`, `asrin.certification_grade` | Tek satır metin | `PMG`, `45` |
| Ürün türü | `asrin.product_type` | `banknote` `coin` `stamp` `accessory` `medal` `antique` `set` | `banknote` |
| Demo işareti | `asrin.is_demo` | Doğru/yanlış | `false` |

Diğer eşlemeler: **Başlık/açıklama** → Shopify ürün başlığı/açıklaması (çevirileriyle) · **Ürün kodu** → varyant SKU ·
**Fiyat** → varyant fiyatı · **Stok** → envanter (varyant başına) · **Fotoğraflar** → ürün medyası (1. görsel ön yüz, 2. görsel arka yüz kabul edilir) ·
**Yeni** etiketi → ürün etiketi `yeni`.

### 2.2 Koleksiyonlar (kategori ağacı)

- Her kategori bir **koleksiyon**dur; handle'lar `src/data/catalog/categories.json` ile aynı tutulmalıdır (URL'ler: `/kategori/<handle>`).
- Hiyerarşi: koleksiyon metafield'ı `asrin.parent` (**koleksiyon referansı**) ve `asrin.sort_order` (tamsayı).
- Bir ürün en derin kategorisine ve tercihen üst kategorilerine eklenir (otomatik koleksiyon kuralları da kullanılabilir).

### 2.3 Ana sayfa seçkisi (metaobject)

Metaobject tanımı **`asrin_home`**, tek kayıt handle'ı **`home`**, Storefront erişimi açık:

| Alan | Tür |
|---|---|
| `hero_products` | Ürün referansı listesi (3 ürün: 1. ve 3. madeni para, 2. banknot önerilir) |
| `featured_collections` | Koleksiyon referansı listesi (kategori şeridi) |
| `category_images` | JSON: `{ "koleksiyon-handle": "urun-handle" }` (şerit görseli) |
| `ottoman_collection`, `ottoman_product` | Koleksiyon / ürün referansı |
| `foreign_collection`, `foreign_products` | Koleksiyon referansı / ürün referansı listesi |
| `antique_collection` | Koleksiyon referansı |

Kurumsal sayfa metinleri (Hakkımızda, kargo, iade, hukuki metinler) şimdilik `src/config/site.ts → BUSINESS / COMMERCE_POLICIES`
ve `src/content/legal.ts` içindedir. İstenirse Shopify **Sayfalar** (`page(handle:)`) veya ayrı metaobject'lere taşınabilir — bu bağlantı henüz yazılmadı.

## 3. Arama ve filtreleme — Shopify'da neler otomatik DEĞİL

Demo modundaki gelişmiş arama (Türkçe harf/diakritik normalleştirme, "1940 1 lira" gibi birleşik sorgu, yıl aralığı, nominal/kondisyon
facet'leri) **Shopify'ın yerel `search` / `products(query:)` API'sinde bu şekilde desteklenmez**:

- `search(query:)` serbest metin arar; alanları açıkça listelenmez. `products(query:)` yalnızca `title`, `product_type`, `tag`, `vendor`,
  `variants.price`, `available_for_sale`, `created_at`, `updated_at` gibi alanları sorgular. **Metafield'larda metin araması yoktur.**
- `ProductFilter` ile `productMetafield` / `variantMetafield` filtreleri, ancak **Search & Discovery** uygulamasında filtre olarak
  tanımlanırsa çalışır; varsayılan olarak yalnızca `available` ve `price` açıktır.

**Bu projedeki çözüm — "dizin modu":** Shopify sağlayıcısı tüm yayımlanmış ürünleri (250'şer sayfa) metafield'larıyla birlikte çeker,
bellekte dizinler ve demo ile **aynı arama/filtre motorunu** (`src/lib/catalog-engine.ts`) kullanır.
- Uygun ölçek: birkaç bin ürüne kadar (20.000 ürün üst sınırı kodda korunur; aşılırsa hata verir).
- Güncellik: dizin `SHOPIFY_CATALOG_CACHE_TTL` saniye (varsayılan 300) önbellekte tutulur; **ürün detay sayfası ve sepet her istekte canlı** sorgulanır.
- Anında güncelleme için webhook: Shopify Admin → Ayarlar → Bildirimler → Webhook'lar:
  `products/create`, `products/update`, `products/delete`, `collections/update`, `inventory_levels/update` → `POST https://<alan-adı>/api/shopify/webhook`
  (imza `SHOPIFY_WEBHOOK_SECRET` ile doğrulanır). Elle: `POST /api/revalidate` + `Authorization: Bearer <REVALIDATE_TOKEN>`.
- Not: Bellek içi önbellek tek süreç içindir. Birden fazla sunucu örneği çalıştırılırsa her örnek kendi önbelleğini tutar; webhook isteği
  yalnızca ulaştığı örneği temizler. Bu durumda TTL'ye güvenin veya paylaşımlı bir önbellek (Redis vb.) ekleyin.
- Katalog çok büyürse dizin modu yerine Shopify Search & Discovery filtreleri + `search` API'sine geçilmelidir (bu durumda birleşik
  yıl/nominal araması kısmen kaybolur).

## 4. Satılan ürünler: "arşivle" ≠ "satıldı"

| Shopify işlemi | Storefront API sonucu | Vitrindeki karşılığı |
|---|---|---|
| Ürün aktif + Headless kanalında yayında + envanter 0 (ve "stok yokken satışa devam et" KAPALI) | Ürün döner, `availableForSale=false` | **Satıldı** etiketi, kendi URL'sinde 200, sepete eklenemez, benzer ürünler önerilir |
| Ürün **arşivlendi** veya kanaldan **yayından kaldırıldı** | Ürün dönmez (`product: null`) | **404**, sitemap'ten çıkar |
| Ürün taslak | Dönmez | 404 |

Satılan ürünün vitrinde kalması için: ürünü **aktif ve Headless kanalında yayında** bırakın, yalnızca envanteri 0 yapın.
Davranış tek merkezden değiştirilebilir: `src/config/site.ts → SOLD_PRODUCTS` (`keepSoldProductPages`, `showSoldInListings`, `soldHttpStatus`).
(Not: "sıfır envanterli yayımlanmış ürün Storefront'ta döner" davranışı resmi dokümanda açıkça yazılı değildir; geliştirme mağazasında doğrulanmalıdır.)

## 5. PayTR

- PayTR'nin resmi Shopify entegrasyonu: Shopify Admin → **Ayarlar → Ödemeler → Alternatif ödeme sağlayıcıları** → "PayTR Sanal POS"
  uygulaması (PayTR belgesi: https://dev.paytr.com/hazir-altyapi/shopify). Kurulum PayTR mağaza paneline giriş ve uygulama aktivasyonu ile tamamlanır;
  önce **test modu** açılabilir.
- PayTR belgesinde belirtilen notlar: müşteriden e-posta ve ad-soyad zorunlu olmalı; **PayTR panelinden yapılan iadeler Shopify siparişine yansımaz**
  (iade süreci işletme tarafından iki sistemde de takip edilmeli).
- PayTR'nin TRY dışı para birimi desteği belgelerde doğrulanamadı; bu nedenle varsayılan `CHECKOUT_CURRENCY_TRY_ONLY=true`:
  yabancı dillerde fiyat **yaklaşık** gösterilir, sepette tahsilatın TRY olduğu ve TRY tutarı açıkça yazılır.
- PayTR `merchant_id / merchant_key / merchant_salt` değerleri **bu uygulamaya girilmez**; yalnızca PayTR ↔ Shopify arasında kalır.

## 6. Canlı test kontrol listesi (hesaplar bağlandıktan sonra)

- [ ] `DATA_SOURCE=shopify` ile `/api/health` → `shopifyConfigured: true`
- [ ] Ana sayfa metaobject'i ve koleksiyon ağacı görünüyor; kategori sayıları doğru
- [ ] Ürün detayında 4 dil başlık/açıklama çevirisi geliyor
- [ ] Envanteri 0 yapılan ürün "Satıldı" görünüyor; arşivlenen ürün 404
- [ ] Sepete ekle → `/api/cart/sync` Shopify sepeti oluşturuyor (cartId yerelde saklanıyor)
- [ ] Ödemeye geç → Shopify checkout açılıyor; tutar sepetteki TRY tutarıyla aynı
- [ ] PayTR test kartıyla test ödemesi → Shopify'da sipariş oluşuyor
- [ ] Shopify'da fiyat değiştir → sepette "fiyat güncellendi" uyarısı, checkout engellenip yeniden onaylanıyor
- [ ] Webhook teslimatı 200 dönüyor, liste/sitemap güncelleniyor
