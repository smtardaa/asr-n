# ASRIN Koleksiyon & Antika — GitHub Pages önizlemesi

Bu klasör, ASRIN vitrininin **GitHub Pages'te yayınlanabilen statik önizleme sürümüdür**. Amaç sitenin telefonda ve
başka cihazlarda incelenebilmesidir; gerçek satış yapılmaz, ürünler **DEMO** envanterdir.

Ana proje (sunuculu, Shopify/PayTR'ye hazır sürüm) ayrı bir klasördedir ve bu klasörden etkilenmez.

## Ana sürümden farkları

| | Ana sürüm (sunuculu) | Bu sürüm (GitHub Pages) |
|---|---|---|
| Sayfa üretimi | İstek anında (Node sunucusu) | Build sırasında, 5.168 statik sayfa (4 dil) |
| Arama, filtre, sıralama, sayfalama | Sunucuda | Tarayıcıda — **aynı arama motoru** (`src/lib/catalog-engine.ts`) ve dil başına katalog dosyası (`/data/catalog-<dil>.json`) |
| Sepet doğrulaması | `/api/cart/sync` | Tarayıcıda, aynı fiyat fonksiyonuyla (`src/lib/money.ts`) |
| Favoriler | Sunucuda listelenir | Tarayıcıda listelenir |
| Veri kaynağı | `DATA_SOURCE=demo` veya `shopify` | Yalnız demo (sunucu olmadan Shopify bağlantısı yapılmaz) |
| Ödeme | Demo'da kapalı | Kapalı (açıklama gösterilir) |
| Adres yapısı | `/urun/<slug>` | `/<depo-adi>/urun/<slug>/` (alt yol + sondaki `/`) |
| Arama motoru | Demo'da noindex | noindex (meta etiketi + robots.txt) |

Tasarım, içerik, diller, fiyat kuralı (tr: TRY · en/ja/ru: USD, örnek kur 1 USD = 48 TRY) ve ürün görselleri aynıdır.
JavaScript kapalıyken ürün/kategori/bilgi sayfaları okunur; arama, filtre ve sepet için JavaScript gerekir.

## GitHub'da yayınlama

1. Bu klasörü yeni bir GitHub deposuna yükleyin (`node_modules/` ve `dist/` `.gitignore` ile dışarıda kalır).
2. GitHub'da: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `main` dalına her push'ta `.github/workflows/deploy-pages.yml` çalışır: kurulum → testler → build → statik çıktı denetimi → yayın.
   Adres ve alt yol (`/depo-adi`) iş akışında otomatik alınır; elle ayar gerekmez.
4. Yayın adresi Actions çalışmasının "deploy" adımında ve Settings → Pages'te görünür: `https://<kullanıcı>.github.io/<depo-adı>/`.

Notlar: GitHub Pages sitesi herkese açıktır (depo özel olsa bile; özel depodan Pages yayını ücretli plan gerektirir).
Toplam çıktı yaklaşık 250 MB'tır (GitHub Pages sınırı 1 GB).

## Yerelde çalıştırma

```bash
npm install
```

```bash
npm run dev
```
Geliştirme: http://localhost:5501

GitHub Pages'teki alt yolu taklit eden üretim önizlemesi:

```bash
BASE_PATH=/asrin-onizleme npm run build
```

```bash
BASE_PATH=/asrin-onizleme npm run preview
```
Açın: http://localhost:5501/asrin-onizleme/ — Windows'ta Git Bash kullanıyorsanız komutların başına `MSYS_NO_PATHCONV=1` ekleyin
(aksi halde Git Bash `/asrin-onizleme` değerini Windows yoluna çevirir).

## Kontroller

```bash
npm test
```
Birim testleri (fiyat dönüşümü, dil/rota, arama, filtre, satıldı davranışı, sepet uyarıları).

```bash
BASE_PATH=/asrin-onizleme npm run check:static
```
`dist/` denetimi: sayfa sayısı, tüm iç bağlantı ve görsellerin gerçek dosyaya karşılık gelmesi, alt yol, canonical/hreflang, noindex,
sitemap, istemci verisi, 4.800 TL → $100.00 kuralı, gizli değer taraması. (`BASE_PATH` build ile aynı olmalıdır.)

```bash
npm run check:types
```

```bash
npm run check:catalog
```

## Demo içerik

Demo ürün bilgileri ve görselleri referans katalogdan (eskiparamarket.com) aktarılmıştır; ASRIN stoğunu temsil etmez.
Sitede DEMO bilgilendirmesi ve "GitHub Pages statik önizlemesi" notu görünür. İşletme iletişim, kargo, iade ve hukuki bilgileri
bilinçli olarak "Doldurulacak" bırakılmıştır.
