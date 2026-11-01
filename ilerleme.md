# ASRIN Koleksiyon & Antika — İlerleme

> **Not (GitHub Pages sürümü):** Bu dosya ana projeden kopyalanmıştır ve ana projenin geçmişini anlatır. Bu klasöre özgü
> farklar ve kullanım README.md'dedir; GitHub sürümünün kaydı ana projenin ilerleme.md dosyasında tutulur.

> Son güncelleme: 2026-11-02 · Durum işaretleri: ✅ tamamlandı · 🔄 devam ediyor · ⏳ bekliyor (dış bilgi/hesap gerekli) · ⚠️ bilinen sorun

## 1. Proje hedefi

Eski para ve numizmatik ürünler (ana) ile antika (ikincil) satan **ASRIN Koleksiyon & Antika** için çok dilli (tr/en/ja/ru),
sunucu tarafında oluşturulan, Shopify Storefront API + PayTR'ye geçişe hazır bir Astro vitrini. Bu aşamada ürünler **DEMO**
envanterdir; gerçek ödeme, üyelik veya sipariş yoktur ve öyleymiş gibi gösterilmez.

## 2. Alınan kararlar

| Konu | Karar |
|---|---|
| Çatı | Astro 7.4.4, `output: 'server'`, resmi `@astrojs/node` 11 (standalone). Hosting belli olmadığı için taşınabilir Node yaklaşımı. Node ≥ 22.23.4. |
| Arayüz | Semantik HTML + tek CSS dosyası (`src/styles/global.css`) + vanilla JS (`src/scripts/main.ts`). React/Vue/UI kütüphanesi ve yönetim paneli yok. |
| Yönlendirme | Tek SSR yönlendirici `src/pages/[...path].astro` + görünümler `src/views/*`. Yerelleştirilmiş yol parçaları `src/i18n/index.ts`. |
| Veri | Ortak sözleşme `src/lib/data/types.ts`; `DATA_SOURCE=demo|shopify`. Shopify hatasında demo'ya dönülmez → 503 hata sayfası. |
| Arama/filtre | Ortak motor `src/lib/catalog-engine.ts` (demo ve Shopify "dizin modu"). Filtreler URL'de, sunucuda uygulanır (JS kapalıyken de çalışır). |
| Önbellek | HTML `no-store`. Shopify'da yalnızca liste/arama dizini ve koleksiyonlar bellek içi TTL (`SHOPIFY_CATALOG_CACHE_TTL`, vars. 300 sn); geçersiz kılma: webhook `/api/shopify/webhook` (HMAC) veya `/api/revalidate` (Bearer). Ürün detayı ve sepet her istekte canlı. "Anlık güncellenir" iddiası yok. |
| Yazı tipleri | Başlık: Cormorant Garamond (500/600/700, Latin+Kiril, yerel), metin: Inter Variable (Latin+Kiril). `unicode-range` ile yalnız gereken alt küme iner. Japonca için web fontu YÜKLENMEZ; Hiragino / Yu / Noto CJK / Meiryo fallback. |
| Görseller | Kaynak ürün fotoğrafları indirildi, beyaz kenarları kırpıldı, 640/320 px WebP'ye dönüştürüldü (`public/catalog/<handle>/`), kaynak URL'leri `src/data/catalog/images.json`'da. Hero/şerit/vitrin alanları da gerçek demo ürün fotoğraflarıyla kuruldu (tek parça arka plan görseli yok). |
| Marka | Pegasus'lu ASRIN logosu oranı korunarak (kare) kullanıldı: `public/brand/`. Referanstaki "Eski Para Market"/EPM öğeleri kullanılmadı. |

## 3. Tamamlanan işler ✅

- Klasör ve görsellerin incelenmesi; referans düzen (ince üst şerit → logo/menü/arama/dil/sepet → hero → görselli kategori şeridi → sıcak beyaz "Yeni keşifler" + sekmeler → Osmanlı/Yabancı iki görsel alan → küçük Antika alanı → footer) birebir sırayla uygulandı.
- **Demo katalog** (bkz. §5): 988 ürün, 286 kategori, 2.393 optimize görsel.
- Sayfalar (4 dilde): ana sayfa, tüm ürünler, ana/alt kategori, ürün detayı, arama, yeni gelenler, satılanlar arşivi, antika kategorisi, sepet, favoriler, hakkımızda, iletişim, SSS (FAQPage JSON-LD), kargo ve teslimat, iptal ve iade, gizlilik / KVKK / çerez / mesafeli satış / ön bilgilendirme / kullanım koşulları **şablonları**, özel 404 (gerçek 404 durum kodu), veri kaynağı hata sayfası (503).
- **Arama:** ad, ürün kodu, ülke (4 dilde ad), yıl ve yıl aralığı, nominal, emisyon/dönem, katalog no, kondisyon; Türkçe İ/ı ve diakritik normalleştirme; birleşik sorgular ("1940 1 lira", "Osmanlı gümüş", "Almanya 100 mark"); ilgililik sıralaması.
- **Filtreler:** kategori, ülke, yıl aralığı, nominal, kondisyon, fiyat aralığı (gösterim para biriminde), stokta/satıldı/tümü, metal ve sertifika (değer varsa). Ayrık facet sayıları, etkin filtre çipleri, temizleme, sonuç yok durumu, sayfalama. Sıralama: yeni eklenenler, fiyat artan/azalan, ada göre. URL'ye yansır; geri/ileri ve paylaşılabilir bağlantılar çalışır. Mobilde erişilebilir alt panel.
- **Ürün detayı:** ön/arka ve ek fotoğraflar, küçük resimler, `<dialog>` ile yakınlaştırma (×2), başlık/fiyat/kondisyon/stok, boş satır üretmeyen özellik tablosu, açıklama, sepete ekle, favori, benzer ürünler, breadcrumb, demo kaynak kaydı notu.
- **Satılan ürün:** kendi URL'sinde 200, "Satıldı" etiketi, sepete eklenemez, "benzer mevcut ürünler"e yönlendirir, JSON-LD `SoldOut`. Tek merkez: `SOLD_PRODUCTS` (`src/config/site.ts`).
- **Sepet:** localStorage (yenilemede ve dil değişiminde korunur), sunucu doğrulaması (`/api/cart/sync`): satıldı / stok azaldı / fiyat değişti / yayında değil uyarıları; uyarı varken ödeme engellenir. Demo'da ödeme butonu devre dışı ve gerçek ödeme olmadığını açıklar; `/api/cart/checkout` demo'da 409 döner. Sahte sipariş numarası/başarı mesajı yok.
- **Favoriler:** gerçekten çalışır (yalnız bu tarayıcıda, açıkça belirtilir). Çalışmayan hesap ikonu eklenmedi.
- **Çok dillilik:** gerçek URL'ler (`/`, `/en/`, `/ja/`, `/ru/`), sunucu HTML'inde dil; merkezi sözlükler (`src/i18n/*.ts`) + ürün içerik katmanı (ürün başlık/açıklamaları 4 dilde). Dil menüsü aynı ürün/kategori/sayfaya (filtrelerle) gider.
- **Fiyat:** sayısal tutar + `Intl.NumberFormat`; tr=TRY, en/ja/ru=USD (demo kur 1 USD = 48 TRY, merkezi ayar); yarım değerleri sıfırdan uzağa tutarlı yuvarlama; demo kur notu sayfalarda ve sepette.
- **Shopify hazırlığı:** Storefront 2026-10 sorguları, dönüştürücüler, Cart API (create/add/update/remove + uzlaştırma), `checkoutUrl` yönlendirme, özel anahtar yalnız sunucuda, buyer IP başlığı, webhook + elle önbellek temizleme, `/api/health`. Rehber: `docs/SHOPIFY.md`.
- **SEO:** sayfaya özgü title/description, doğru `lang`, başlık hiyerarşisi, temiz URL'ler, kendini gösteren canonical (filtreli sayfalarda filtresiz canonical + noindex), karşılıklı hreflang tr/en/ja/ru + x-default, Open Graph (ürün görseli / varsayılan 1200×630 marka görseli), alt metinler, breadcrumb + BreadcrumbList, Product/Offer JSON-LD (görünen fiyat/para birimi/stokla aynı; puan, GTIN, marka, garanti yok), Organization yalnız dolu alanlarla. Dinamik `/sitemap.xml` (5.156 URL = (15 sabit + 286 kategori + 988 ürün) × 4 dil, sepet/arama/filtre hariç, lastmod yalnız gerçek `updatedAt` varsa). `/robots.txt`. Demo/staging'de meta + `X-Robots-Tag` noindex; indeksleme yalnız `DEPLOY_ENV=production` + `ALLOW_INDEXING=true`. Üretimde localhost/example/https olmayan `SITE_URL` ile build ve sunucu başlatılmaz.
- **Erişilebilirlik:** içeriğe geç bağlantısı, görünür odak halkası, klavyeyle mobil menü (odak tuzağı, Escape, odak geri dönüşü), dil menüsü (ok tuşları/Home/End/Escape), koleksiyon menüsü, ana sayfa sekmeleri (ok tuşları), form etiketleri, `aria-live` sepet durumu, `prefers-reduced-motion`.
- **Performans:** ilk ekran görseli `fetchpriority=high` (lazy değil), aşağıdakiler `loading=lazy`; tüm görsellerde width/height (CLS); responsive `srcset` (320/640); tek CSS + tek küçük JS paketi.
- README (kurulum, geliştirme, build, önizleme, ortam değişkenleri, veri kaynağı değiştirme, canlıya geçiş) ve `.env.example`.

## 4. Devam eden / bekleyen işler

### ⏳ Gerçek hesap ve işletme bilgisi gerektirenler
- Shopify mağazası, Headless kanal ve özel Storefront anahtarı; metafield / koleksiyon hiyerarşisi / `asrin_home` metaobject tanımları; ürünlerin ve çevirilerin girilmesi (`docs/SHOPIFY.md` §2).
- PayTR Sanal POS'un Shopify'a bağlanması ve test ödemesi (`docs/SHOPIFY.md` §5).
- `docs/SHOPIFY.md` §6 canlı test kontrol listesi — **hiçbiri canlı test edilmedi.**
- Alan adı → `SITE_URL`; hosting seçimi.
- İşletme bilgileri ve hukuki metinler (§7).

### 🔄 İsteğe bağlı sonraki geliştirmeler
- Kurumsal/hukuki sayfa metinlerini Shopify Sayfalar'dan okuma (şu an `src/config/site.ts` + `src/content/legal.ts`).
- Çok örnekli dağıtımda paylaşımlı önbellek (Redis vb.).
- Gerçek Lighthouse/Core Web Vitals ölçümü (yapılmadı).

## 5. Demo katalog kapsamı, kaynakları ve eksikleri

- **Kaynak:** https://eskiparamarket.com/ (OpenCart). `robots.txt` tüm yollara izin veriyor. Tarama: 2026-11-01/02.
- **Kapsam:** "Tüm ürünler" listesi kaynakta **988 ürün (83 sayfa × 12)** bildiriyordu; `limit=100` ile 10 sayfa tarandı → **988/988 ürün** listelendi, 988 ürün detay sayfası çekildi, **988/988 ürünün görselleri** indirildi (2.393 görsel, 0 hata).
- **Kategoriler:** menüdeki 285 kategori yolunun tamamı sayfalamasıyla tarandı (üyelik sayıları kaynaktaki "toplam" değerleriyle birebir eşleşti). Sitede 286 kategori (10 ana): T.C. Kağıt (60 ürün; 1–9. emisyon + 6/7/8. emisyon nominal alt kategorileri), T.C. Madeni (19), T.C. Hatıra (21), Osmanlı (6; kağıt/madeni + hükümdarlar), Yabancı (903; 215 ülke), Sertifikalı (6), Pul (0), Koleksiyon Malzemeleri (3), Madalya ve Objeler (0), Antika (0).
- **Doğrulanmış ürünü olmayan kategoriler: 62** (ör. Pul, Madalya ve Objeler, Antika, Föyler, Kataloglar, Abdülaziz, IV. Murat, 9. Emisyon, 2004 ve sonrası, 40+ ülke). Bu kategoriler hazır; sayfalarında "henüz doğrulanmış ürün yok" yazar. **Uydurma ürün eklenmedi.**
- Kaynak menüdeki "MADALYA VE OBJE" bağlantısı aslında "fırsat ürünü" listesine (çoğu banknot) gidiyordu; bu ürünler kendi ülke/kategorilerinde tutuldu, Madalya ve Objeler boş bırakıldı. Antika kategorisinde kaynakta doğrulanmış ürün bulunmadı.
- Kaynakta adı ile handle'ı uyuşmayan kategorilerde (ör. `burkina-faso` → "Burma", `guney-osetya` → "Güney Vietnam", `mikronezya…` → "Merkezi Afrika Devletleri", `niue` → "New Hebrides") ürünlerin gerçekte bağlı olduğu **görünen ad** esas alındı ve temiz handle verildi.
- Minimal düzeltmeler: "İsmet İnönü 1940 Gümüş 1 Lira" kaynakta Koleksiyon Malzemeleri'ndeydi → T.C. Madeni / 1924–1957. Yalnız fırsat listesinde görünen 2 fantazi para ve 1 hatıra para başlığa göre yerleştirildi. "Yabancı Paralar › Türkiye" altındaki ürünlerin ülke değeri "Türkiye" ile birleştirildi.
- **Alanlar:** sabit kimlik (`asrin-demo-<kaynak id>`), slug, kategori/alt kategori, ülke, emisyon, tertip, hükümdar, yıl/yıl aralığı (Hicrî tarihler dönüştürülmeden "H." ile), nominal + birim, kondisyon, katalog no (Pick), metal, sertifika kurumu/derece, ürün kodu, görseller, TL fiyat, kaynak URL. Ayrıştırma oranları: nominal 973/988, yıl 956/988, kondisyon 974/988, katalog no 915/988. Bulunamayan alanlar boş bırakıldı ve arayüzde satır üretmez.
- **Başlık/açıklama:** kaynak başlıklardaki doğrulanmış bilgilerden 4 dilde yeniden yazıldı (969 şablonla, 19 elle). Açıklamalarda kaynak ilan başlığı "kaynak kayıt" olarak açıkça belirtilir. Kaynak sitenin iletişim, şirket, garanti, kargo ("ücretsiz kargo" etiketleri dahil) ve iade metinleri **kopyalanmadı**.
- **Demo stok:** kaynakta 988 ürünün tamamı "Stok: Var" idi. Satıldı davranışını göstermek için kaynak id'si 23'e bölünebilen **42 ürün DEMO olarak "satıldı"** işaretlendi (`demoSold`) — bu kaynak verisi değildir. Mevcut ürünlerde demo stok adedi 1 kabul edildi.
- "Yeni eklenenler" sıralaması gerçek tarih olmadığından kaynak ürün id sırasına göredir; "Yeni" etiketi kaynaktaki etiketten gelir.
- Yeniden üretim: `scripts/catalog/scrape.py`, `build_catalog.py`, `lexicon.py`, `fetch-images.mjs` (README).

## 6. Demo / canlı mod farkları

| | Demo (`DATA_SOURCE=demo`) | Canlı (`DATA_SOURCE=shopify`) |
|---|---|---|
| Ürün/kategori | `src/data/catalog/*.json` | Storefront API ürün + koleksiyon + metafield |
| Fiyat gösterimi | TRY → USD demo kur (1 USD = 48 TRY) | Shopify pazar bağlamı (`@inContext`); yalnız TRY tahsilatında yaklaşık yabancı para + TRY tutarı |
| Stok | `demoSold` alt kümesi, adet 1 | `availableForSale`, `quantityAvailable` |
| Sepet | localStorage + sunucu doğrulaması | + Shopify Cart (cartId yerelde) |
| Ödeme | Kapalı, açıklama gösterilir, 409 | Yeniden doğrulama → `checkoutUrl` → Shopify + PayTR |
| Demo bilgilendirmesi | Görünür | `SHOW_DEMO_NOTICE=false` ile tek ayarda kalkar |
| Ana sayfa seçkisi | `src/data/editorial.json` | `asrin_home` metaobject |

## 7. Doldurulacak işletme bilgileri (sitede "Doldurulacak" görünür)

`src/config/site.ts → BUSINESS`: ticari unvan, vergi dairesi/no, MERSİS, telefon, WhatsApp, e-posta, adres, harita bağlantısı, çalışma saatleri,
sosyal medya, işletme geçmişi. `COMMERCE_POLICIES`: kargo firması, ücret, süre, ücretsiz kargo sınırı, iade ve iptal koşulları.
Hukuki metinlerin işletmeye özgü bölümleri: gizlilik, KVKK, çerez, mesafeli satış, ön bilgilendirme, kullanım koşulları (`src/content/legal.ts` yalnız başlıklar).
Boş alanlar için `tel:`, `mailto:`, WhatsApp veya harita bağlantısı üretilmez; JSON-LD'ye eklenmez. "50 yıllık deneyim", "ücretsiz kargo", "orijinallik garantisi" gibi vaat yoktur.

## 8. Dil ve demo kur varsayımları

- Diller: Türkçe `/`, İngilizce `/en/`, Japonca `/ja/` (kod `ja`), Rusça `/ru/`. Ürün handle'ları dillerde aynıdır.
- Para birimi: tr → TRY; en, ja, ru → USD (ja/ru için USD **geçici**; `PRICING.displayCurrencyByLocale`).
- Demo kur: **1 USD = 48 TRY** (`PRICING.demoRates`) — canlı piyasa kuru değildir; sayfalarda belirtilir. 4.800 TL → 100,00 USD (testle doğrulandı).
- Canlıda dil, ülke/pazar (`SHOPIFY_CONTEXT`) ve para birimi ayrı kavramlardır; dil değişimi ödeme para birimini değiştirmez.
- Ürün başlıkları için para birimi adları ja/ru'da sözlükle çevrildi; sözlükte olmayan nadir birimler Latin harfle kalır.

## 9. Satılan ürünlerin gösterimi (değiştirilebilir karar)

`src/config/site.ts → SOLD_PRODUCTS`: `keepSoldProductPages: true` (URL'de kalır), `showSoldInListings: false` (varsayılan listelerde
gizli; "Satılanlar" arşivi ve "Satıldı" filtresinde görünür), `soldHttpStatus: 200`, `similarAvailableCount: 4`.
Shopify'da "arşivle/yayından kaldır" (→ 404) ile "envanter 0, yayında" (→ Satıldı) farkı `docs/SHOPIFY.md` §4'te.

## 10. Yapılan kontroller ve sonuçları (2026-11-02)

| Kontrol | Sonuç |
|---|---|
| `npm run build` | ✅ Başarılı (Astro 7.4.4, @astrojs/node 11.1.9) |
| `npm test` (15 birim testi) | ✅ 15/15 — fiyat dönüşümü, dil/rota, normalleştirme, birleşik arama, arama+filtre+sıralama, satıldı, sepet uyarıları, içerik dili, URL ayrıştırma, sağlayıcı seçimi (Shopify yapılandırması yokken demo'ya dönmeme), üretim URL doğrulaması, Shopify dönüştürücüleri, webhook HMAC |
| `npm run check:site` (66 kontrol) | ✅ 66/66 — 4 dil doğrudan URL + lang, canonical, hreflang+x-default, `/en`→301, 4.800 TL→$100.00 ve JSON-LD tutarlılığı, ilk HTML'de h1/description/OG, dil menüsünün aynı ürüne gitmesi, satılan ürün (200, etiket, buton yok, SoldOut, API engeli), demo checkout 409, arama noindex, filtreli canonical, sonuç yok, 404'ler, 19 sayfa 200, iletişimde geçersiz bağlantı yok, sitemap 5.156 URL, robots, noindex başlığı, 345 iç bağlantı + 164 görsel kırık değil, istemci paketinde gizli anahtar yok |
| Üretim koruması | ✅ `DEPLOY_ENV=production` + `SITE_URL=http://localhost…` / `…example.com` → build betiği hata kodu 1. `ALLOW_INDEXING=true` + gerçekçi https alan adıyla `index, follow`, canonical doğru alan adı, robots.txt sitemap'li, demo bandı kapalı. |
| Tarayıcı (uygulama içi) | ✅ Masaüstü 1280px, tablet 768px, mobil 375px görsel kontrol; sepete ekle → dil değiştir (aynı ürün, sepet korunur) → sepet sayfası; mobil filtre paneli → filtre uygula (`?country=meksika`) → geri tuşu; klavyeyle mobil menü ve dil menüsü. |
| Yatay taşma | ✅ 375/768/1024 px'te 7 sayfa (tr/ru/ja dahil) taşma yok (Rusça sıralama menüsü taşması düzeltildi). |
| Referansla karşılaştırma | ✅ Bölüm sırası, bordo/kırmızı/altın dağılımı, hero düzeni (solda büyük serif başlık + altın "büyüt.", sağda para/banknot kompozisyonu), kategori şeridi, sekmeli yeni ürünler ve iki vitrin alanı uygulama içi tarayıcıda gözle karşılaştırıldı. Ekran görüntüleri dosya olarak kaydedilmedi. |
| Yapılamayanlar | ⚠️ Shopify/PayTR canlı testi (hesap yok). Lighthouse/CWV ölçümü. Gerçek ekran okuyucu (NVDA/VoiceOver) testi. Safari/iOS ve Firefox'ta gözle kontrol (yalnız Chromium tabanlı uygulama içi tarayıcı). |

## 11. Bilinen sorunlar ⚠️

- **Demo içerik telif/doğruluk:** ürün verileri ve fotoğraflar eskiparamarket.com'a aittir; yalnız demo içindir, canlıda kullanılmamalı ve ASRIN'in kendi ürün/fotoğraflarıyla değiştirilmelidir.
- Ürün başlık/açıklamaları otomatik olarak kaynak başlıktan üretildi; birkaç kaynak başlığında belirsizlik var (ör. "1340 (1924) 5 Kuruş" kaynakta Osmanlı kategorisinde). Canlı katalogda ürün metinleri işletme tarafından gözden geçirilmeli.
- Japonca/Rusça başlıklarda nadir para birimi adları Latin harfle kalabilir; Japonca başlıklarda Latin rakamlar Cormorant ile, Japonca karakterler sistem fontuyla gösterilir.
- Shopify dizin modu bellek içidir (süreç başına); çoklu örnekte paylaşımlı önbellek gerekir. Sıfır envanterli yayımlanmış ürünün Storefront'ta dönmesi geliştirme mağazasında doğrulanmalı.
- Astro Node adapter'ı "sessions" depolamasını varsayılan olarak etkinleştiriyor (kullanılmıyor; zararsız).
- `public/catalog` ~136 MB (4.786 WebP). Canlıda Shopify CDN kullanılacağı için demo görseller kaldırılabilir.

## 12. Değiştirilen / oluşturulan temel dosyalar

- Yapılandırma: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.env.example`, `.gitignore`, `.claude/launch.json`
- Ayarlar ve i18n: `src/config/site.ts`, `src/i18n/{index,tr,en,ja,ru}.ts`, `src/content/legal.ts`
- Veri: `src/lib/data/{types,index}.ts`, `src/lib/data/demo/provider.ts`, `src/lib/data/shopify/{client,queries,mappers,provider}.ts`, `src/data/catalog/{products,categories,images,units,catalog-report}.json`, `src/data/editorial.json`
- Mantık: `src/lib/{env,money,text,catalog-engine,query,seo,labels,page}.ts`, `src/middleware.ts`
- Sayfalar/uç noktalar: `src/pages/[...path].astro`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`, `src/pages/api/{health,revalidate}.ts`, `src/pages/api/cart/{sync,checkout}.ts`, `src/pages/api/shopify/webhook.ts`
- Arayüz: `src/layouts/Base.astro`, `src/components/{Header,Footer,ProductCard,Breadcrumbs,Pagination,Icon}.astro`, `src/views/{Home,Listing,Product,Cart,Favorites,Content,Status}View.astro`, `src/styles/global.css`, `src/scripts/main.ts`
- Varlıklar: `public/brand/*`, `public/favicon-32.png`, `public/apple-touch-icon.png`, `public/catalog/**`
- Betikler/test: `scripts/{check-env,serve,smoke,brand-assets}.mjs`, `scripts/catalog/*`, `tests/unit.test.ts`
- Belgeler: `README.md`, `docs/SHOPIFY.md`, bu dosya
- Mevcut kullanıcı dosyaları (`ASRIN logo..png`, `ASRIN örnek tasarım..png`) değiştirilmedi/silinmedi.

## 13. Sonraki somut adım

Shopify'da bir **geliştirme mağazası** açıp Headless kanalından özel Storefront anahtarını almak; `docs/SHOPIFY.md` §2.1'deki
metafield tanımlarını ve birkaç test ürünü/koleksiyonu oluşturmak; `.env` → `DATA_SOURCE=shopify` ile §6 canlı test listesini çalıştırmak.
Paralelde işletme bilgilerini (`BUSINESS`, `COMMERCE_POLICIES`) ve alan adını netleştirmek.

---

## 14. Tamamlanma Kontrolü ve Hata Ayıklama (2026-11-02)

Kapsam: ilk gereksinimler, mevcut dosyalar, `package.json`/kilit dosyası ve bu dosyadaki "tamamlandı" kayıtları uygulamanın gerçek
davranışıyla karşılaştırıldı. Proje bir git deposu değil; bu nedenle değişiklik geçmişi incelenemedi, hiçbir dosya geri alınmadı veya silinmedi.
Sıfır baytlık dosya, yarım kalmış kod, kapanmamış ifade, bozuk Türkçe karakter (mojibake), lorem ipsum, TODO/FIXME veya ekranda görünen
çeviri anahtarı **bulunmadı**.

### 14.1 Tespitler

| # | Sorun ve kullanıcıya etkisi | Nasıl tespit edildi | Neden | Düzeltilen dosyalar | Yapılan düzeltme | Doğrulama | Durum |
|---|---|---|---|---|---|---|---|
| 1 | **Ana sayfa kategori şeridi sola yaslıydı**; 1240px'den geniş ekranlarda sağda büyük boşluk kalıyordu (1680px'te sol 0px, sağ 440px). 900–1100px arasında 7 kategori 4+3 olarak iki satıra bölünüyordu. | Kullanıcı bildirimi + tarayıcıda `getBoundingClientRect` ölçümü | `.cat-strip ul { margin: 0; padding: 18px 0 }` kuralı, aynı öğedeki `.container` sınıfının `margin-inline: auto` ve yan boşluk değerlerini eziyordu; 1100px kırılımı ızgarayı 4 sütuna düşürüyordu. | `src/styles/global.css` | Şerit Flexbox'a çevrildi: yalnız dikey `padding-block`/`margin-block` verildi (yatay merkezleme `.container`'a bırakıldı); öğeler `flex: 0 1 172px; min-width: 124px` (mobilde 112px); grup sığdığında ilk/son öğedeki `margin-inline: auto` ile ortalanıyor, sığmadığında `overflow-x: auto` ile kaydırılıyor (auto kenar boşlukları 0'a düştüğü için ilk/son öğe erişilebilir kalıyor; `transform` veya sabit sol boşluk kullanılmadı). Kaydırmada kenar boşluğu korunsun diye `scroll-padding-inline` eklendi. Eski 4 sütun ve `nth-child` istisna kuralları kaldırıldı; görseller, renkler, yazı tipleri ve ayırıcı çizgiler değişmedi. | 10 genişlikte ölçüm: 1920 (sol/sağ 365/365px), 1440 (125/125), 1280 (45/45), 1024 (31/31) — eşit, tek satır, bordo zemin tam genişlik; 900/768/414/375 px'te tek satır + yatay kaydırma, ilk öğe kenar boşluğunda (16–27px), son öğe kaydırmayla erişilebilir, sayfada yatay taşma yok. 1680px masaüstünde gözle kontrol edildi. | Düzeltildi |
| 2 | Üst menüde "Yeni Gelenler" / "New Arrivals" 901–1000px genişlikte iki satıra kırılıyordu. | Sepet sayfası ekran görüntüsü + 6 genişlik × 4 dilde ölçüm | Menü bağlantılarında `white-space: nowrap` yoktu. | `src/styles/global.css` | `.main-nav a, .nav-trigger` için `white-space: nowrap`. | 901/930/960/1024/1100px × tr/en/ja/ru: kırılma yok, logo/menü/eylemler çakışmıyor, sayfa taşması yok. | Düzeltildi |
| 3 | Sepette en fazla adede ulaşıldığında pasif "+" düğmesi aktif gibi görünüyordu (tıklanamıyordu ama görsel ipucu yoktu). | Sepet testi (tek stoklu ürün) | Pasif durum stili tanımlı değildi. | `src/styles/global.css` | `.qty button:disabled` için soluk görünüm ve `not-allowed` imleci. | `disabled` niteliği tek stoklu ürünlerde doğrulandı. | Düzeltildi |
| 4 | EN/JA/RU sayfalarında Türkçe kondisyon terimleri ("Çil altı", "Çil-", "Çok temiz-") ve sertifika kurumu "Darphane" çevrilmeden görünüyordu (kart, ürün detayı, filtre, çip, sepet). | Diğer dillerdeki sayfalarda Türkçe karakter taraması | Bu değerler yerelleştirme katmanından geçmiyordu. | `src/lib/labels.ts`, `src/lib/page.ts`, `src/views/ListingView.astro`, `src/views/ProductView.astro`, `src/pages/api/cart/sync.ts` | `conditionLabel()` eklendi: diğer dillerde karşılık + orijinal terim parantez içinde (ör. "About Uncirculated (Çil altı)"); "Darphane" → "Turkish State Mint (Darphane)" vb. Türkçe görünüm değişmedi. | 14 sayfa × 3 dil taramasında arayüz metninde Türkçe terim kalmadı (yalnız özel adlar ve açıkça "kaynak ilan başlığı" olarak belirtilen alıntılar). Smoke testine kontrol eklendi. | Düzeltildi |
| 5 | Hicrî tarihli 4 Osmanlı ürününün Rusça açıklamasında çift nokta ("1327/4 г. х..") vardı. | Ürün metinlerinde bozuk desen taraması | Kısaltmayla biten tarihe cümle sonu noktası ekleniyordu. | `scripts/catalog/build_catalog.py`, `src/data/catalog/products.json` | Açıklama üreticisinde çift nokta temizliği; katalog yerel ham veriden yeniden üretildi (kaynak yeniden indirilmedi). | Yeniden üretim yalnız bu 4 ürünü değiştirdi (988 ürünün 984'ü birebir aynı). | Düzeltildi |
| 6 | `astro check` 21 hata veriyordu (çoğu eksik Node tip tanımları; 3'ü `main.ts` içinde gerçek tür hatası) ve tip denetimi aracı kurulu değildi. | `npx astro check` | `@astrojs/check`, `typescript`, `@types/node` geliştirme bağımlılıkları yoktu; sepet betiğinde kapanış içinde `null` daraltması kayboluyordu. Ayrıca kullanılmayan bir import. | `package.json`, `package-lock.json`, `src/scripts/main.ts`, `src/pages/[...path].astro` | Geliştirme bağımlılıkları eklendi; `main.ts`'te daraltılmış `root` değişkeni; kullanılmayan import kaldırıldı; `npm run check:types` komutu eklendi. | `astro check`: 0 hata, 0 uyarı (2 bilgi notu). | Düzeltildi |
| 7 | `package.json` içinde var olmayan `scripts/check-secrets.mjs` dosyasını çalıştıran `check:secrets` komutu vardı (çalıştırılırsa hata verirdi). | Komut/dosya karşılaştırması | Nedeni doğrulanamadı (dosya ilk turda hiç oluşturulmamış; gizli anahtar taraması `scripts/smoke.mjs` içinde yapılıyordu). | `package.json` | Komut kaldırıldı; yerine `check:types` ve `check:catalog` eklendi. | `npm run` komutlarının hepsi mevcut dosyalara işaret ediyor. | Düzeltildi |
| 8 | `node_modules` içinde kilit dosyasında olmayan 4 "extraneous" paket vardı. | `npm ls` | Nedeni doğrulanamadı. | — (`node_modules`) | `npm prune` ile 2'si kaldırıldı; `@img/sharp-wasm32` ve `@napi-rs/wasm-runtime` sonraki `npm install` ile yeniden görünüyor (sharp'ın isteğe bağlı paketleri olduğu düşünülüyor, doğrulanmadı). Kilit dosyası ile `package.json` sürümleri birebir uyumlu. | Build ve testler etkilenmedi. | Bekliyor (zararsız) |
| 9 | Katalog bütünlüğü için tekrar çalıştırılabilir bir kontrol yoktu. | Gereksinim karşılaştırması | — | `scripts/audit-catalog.mjs` (yeni), `package.json`, `README.md` | Yinelenen kimlik/slug, eksik fiyat/çeviri, kategori bağlantısı ve her görselin sharp ile çözülüp boyutunun kayıtla eşleşmesini denetleyen `npm run check:catalog`. | 988 ürün, 286 kategori, 0 yinelenen kimlik/slug, 0 eksik fiyat/çeviri/görsel, 4.786 görselin tamamı geçerli WebP, sahipsiz görsel klasörü yok. | Düzeltildi |
| 10 | Smoke testi yalnız birkaç sabit sayfanın 4 dilde açıldığını ve hreflang'ın varlığını kontrol ediyordu; karşılıklılık, tek h1 ve benzersiz meta denetlenmiyordu. | Gereksinim karşılaştırması | — | `scripts/smoke.mjs`, `README.md` | 68 sabit sayfa (17 × 4 dil) doğrudan URL + `lang`; ürün/kategori/SSS/ana sayfa için tüm dil sürümlerinde aynı hreflang kümesi ve canonical; sayfa başına tek h1; title/description benzersizliği; kondisyon yerelleştirme kontrolü eklendi. | 71/71 başarılı. | Düzeltildi |

Sorunsuz bulunan (değişiklik gerekmeyen) kontroller: arama (ad, ülke, yıl, nominal, ürün kodu, birleşik sorgular), filtre + sıralama +
temizleme + sonuç yok durumu, filtrelerin URL'ye yansıması ve geri tuşu, sepete ekleme/çıkarma, tek stoklu üründe adet sınırı
("stoktaki tüm adetler sepetinizde" uyarısı), sayfa yenilemede ve dil değişiminde sepetin korunması, sonradan satılan/fiyatı değişen ürün
uyarıları ve ödemenin engellenmesi, satılan ürün sayfası, demo ödemenin kapalı olması (409, sahte başarı/sipariş mesajı yok),
teklif/pazarlık/açık artırma/"fiyat sor" özelliğinin **bulunmaması**, dil menüsü ve mobil menünün klavyeyle kullanımı, mobil filtre paneli, favoriler.

### 14.2 Çalıştırılan kontroller ve sonuçları

| Kontrol | Sonuç |
|---|---|
| `npm run check:types` (astro check) | 0 hata, 0 uyarı |
| `npm test` | 15/15 başarılı |
| `npm run check:catalog` | Başarılı (yukarıdaki sayımlar) |
| `npm run build` | Başarılı |
| `npm run check:site` (üretim build'ine karşı) | 71/71 başarılı |
| `npm run dev` → http://localhost:5500 | Açıldı; ana sayfa, ürün (EN $100.00), kategori (JA), sitemap 200 |
| Tarayıcı: 18 sayfa (tr/en/ja/ru, kategori, ürün, arama, sepet, bilgi, hukuki şablon, 404) | Konsol hatası yalnız bilinçli 404 sayfasının isteği; başarısız kaynak isteği yok, bozuk görsel yok, ekranda `{n}`/`undefined`/`NaN` yok |
| Fiyat tutarlılığı (aynı ürün: kart / detay / sepet satırı / ara toplam) | en/ja: $100.00 ×4, ru: 100,00 $ ×4, tr: ₺4.800,00 |
| Shopify modu, anahtar yokken (ayrı portta) | Sayfalar ve sitemap 503, sepet API'si 503, demo fiyatı gösterilmiyor (sessiz demo dönüşü yok); `/api/health` gizli değer içermiyor |
| Kaynak katalog erişimi | eskiparamarket.com erişilebilir ve hâlâ "toplam: 988" bildiriyor = yerel kayıt 988; eksik aktarım yok, yeniden indirme gerekmedi |

### 14.3 Önceki gereksinimlerden eksik kalıp bu turda tamamlananlar
- Ana sayfa kategori şeridinin geniş ekranlarda ortalanması ve orta genişlikte tek satırda kalması (#1).
- Diğer dillerde kondisyon terimleri ve sertifika kurumu çevirisi (#4) — "ürün içerikleri ve filtreler çevrilsin" gereksiniminin eksik kalan kısmı.
- Tip denetimi ve katalog bütünlüğü için çalıştırılabilir kontroller (#6, #9); hreflang karşılıklılığı ve tüm sabit sayfaların 4 dilde doğrudan URL testi (#10).

### 14.4 Bilinçli bırakılan işletme bilgileri ("Doldurulacak" — hata değildir)
Telefon, WhatsApp, e-posta, adres, harita, çalışma saatleri, sosyal medya, ticari unvan/vergi/MERSİS, işletme geçmişi, kargo firması/ücret/süre,
ücretsiz kargo sınırı, iade ve iptal koşulları, hukuki metinlerin işletmeye özgü bölümleri (`src/config/site.ts`, `src/content/legal.ts`).

### 14.5 Gerçek hesap veya API erişimi bekleyen işlemler
- Shopify geliştirme mağazası + Headless kanal özel anahtarı; metafield/koleksiyon/metaobject kurulumu; Shopify modunda uçtan uca test (`docs/SHOPIFY.md` §6).
- PayTR Sanal POS'un Shopify'a bağlanması ve test ödemesi. **Shopify ve PayTR hiçbir aşamada canlı test edilmedi.**
- Alan adı (`SITE_URL`) ve hosting; canlı indekslemenin açılması.

### 14.6 Araç veya erişim nedeniyle yapılamayan / sınırlı kalan kontroller
- Git deposu olmadığından önceki değişikliklerin farkı incelenemedi.
- Bu turdaki mobil ekran görüntüleri araç tarafından döşenmiş (2×2) yakalandı; mobil yerleşim bu nedenle ekran görüntüsüyle değil ölçümle (öğe konumları, taşma, kaydırma) doğrulandı. Masaüstü (1680px) görüntüsü düzgün alındı.
- Safari/iOS ve Firefox'ta gözle kontrol, gerçek ekran okuyucu testi ve Lighthouse/Core Web Vitals ölçümü yapılmadı (yalnız Chromium tabanlı uygulama içi tarayıcı).
- Kaynak siteye erişim bu turda çalıştı; erişim kesintisine bağlı veri kaybı tespit edilmedi. Yukarıdaki sorunların hiçbiri kanıtlanabilir biçimde internet kesintisinden kaynaklanmıyor.
