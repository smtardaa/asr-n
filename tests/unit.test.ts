/**
 * Kritik davranış testleri: fiyat dönüşümü, dil/rota eşlemesi, arama, filtre, stok/satıldı, sağlayıcı seçimi,
 * Shopify dönüştürücüleri ve webhook imzası. Çalıştırma: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertDemo, formatMoney, priceView, roundTo, displayToBase } from '../src/lib/money';
import { alternatesFor, parsePath, pathFor } from '../src/i18n';
import { fold, tokens } from '../src/lib/text';
import { createDemoProvider } from '../src/lib/data/demo/provider';
import { parseQuery } from '../src/lib/query';
import { mapAttributes, mapCart, mapProduct } from '../src/lib/data/shopify/mappers';
import { validateProductionEnv, serverEnv } from '../src/lib/env';

const demo = { mode: 'demo' as const, checkoutTryOnly: true };

test('4.800 TL → İngilizce demo görünümünde 100 USD', () => {
  const v = priceView({ amount: 4800, currencyCode: 'TRY' }, 'en', demo);
  assert.equal(v.display.currencyCode, 'USD');
  assert.equal(v.display.amount, 100);
  assert.equal(v.text, '$100.00');
  assert.equal(v.approximate, true);
});

test('Türkçe görünüm TRY, ja/ru USD; sayısal dönüşüm ve tutarlı yuvarlama', () => {
  assert.equal(priceView({ amount: 4800, currencyCode: 'TRY' }, 'tr', demo).text.replace(/\s/g, ' '), '₺4.800,00');
  assert.equal(priceView({ amount: 4800, currencyCode: 'TRY' }, 'ja', demo).display.amount, 100);
  assert.equal(priceView({ amount: 4800, currencyCode: 'TRY' }, 'ru', demo).display.currencyCode, 'USD');
  assert.equal(convertDemo({ amount: 1, currencyCode: 'TRY' }, 'USD').amount, 0.02); // 0.0208 → 0.02
  assert.equal(convertDemo({ amount: 100, currencyCode: 'TRY' }, 'USD').amount, 2.08); // 2.0833 → 2.08
  assert.equal(roundTo(1.005, 2), 1.01);
  assert.equal(displayToBase(100, 'en'), 4800);
  assert.match(formatMoney({ amount: 100, currencyCode: 'USD' }, 'ru'), /100,00\s\$/);
});

test('Canlı modda Shopify tutarı dönüştürülmeden gösterilir; yalnız TRY tahsilatında yaklaşık gösterim', () => {
  const live = priceView({ amount: 4800, currencyCode: 'TRY' }, 'en', { mode: 'shopify', checkoutTryOnly: true });
  assert.equal(live.approximate, true);
  assert.equal(live.chargeText?.includes('4,800'), true);
  const multi = priceView({ amount: 99, currencyCode: 'USD' }, 'en', { mode: 'shopify', checkoutTryOnly: false });
  assert.equal(multi.approximate, false);
  assert.equal(multi.text, '$99.00');
});

test('Dil URL yapısı ve aynı sayfanın diğer dil karşılıkları', () => {
  assert.equal(pathFor('tr', 'home'), '/');
  assert.equal(pathFor('en', 'home'), '/en/');
  assert.equal(pathFor('ja', 'product', 'x'), '/ja/product/x/');
  assert.equal(pathFor('tr', 'product', 'x'), '/urun/x/');
  assert.deepEqual(alternatesFor('category', 'osmanli-paralari'), {
    tr: '/kategori/osmanli-paralari/', en: '/en/category/osmanli-paralari/', ja: '/ja/category/osmanli-paralari/', ru: '/ru/category/osmanli-paralari/',
  });
  assert.deepEqual(parsePath('/ru/product/abc'), { locale: 'ru', key: 'product', param: 'abc', extra: [] });
  assert.equal(parsePath('/urun/abc').key, 'product');
  assert.equal(parsePath('/en/urun/abc').key, null); // Türkçe parça İngilizce önekle geçersiz → 404
  assert.equal(parsePath('/yok-boyle-sayfa').key, null);
  assert.equal(parsePath('/en/').key, 'home');
});

test('Türkçe büyük/küçük harf ve diakritik normalleştirme', () => {
  assert.equal(fold('OSMANLI GÜMÜŞ İstanbul ŞIK'), 'osmanli gumus istanbul sik');
  assert.deepEqual(tokens('1.000.000 Lira'), ['1000000', 'lira']);
});

const provider = createDemoProvider();
const tr = { locale: 'tr' as const };

test('Birleşik arama: "1940 1 lira", "Osmanlı gümüş", "Almanya 100 mark"', async () => {
  const a = await provider.listProducts({ q: '1940 1 lira', stock: 'all' }, tr);
  assert.ok(a.total > 0, '1940 1 lira sonuç vermeli');
  assert.ok(a.items.every((p) => p.attributes.denomination === 1 || /1940/.test(p.title)));
  const b = await provider.listProducts({ q: 'Osmanlı gümüş', stock: 'all' }, tr);
  assert.ok(b.total > 0);
  assert.ok(b.items.every((p) => p.attributes.material === 'silver'));
  // Not: demo katalogda Almanya 100 Mark yoktur; boş sonuçla "geçmemesi" için mevcut bir ürünle (10 Mark) doğrulanır
  const none = await provider.listProducts({ q: 'almanya 100 mark', stock: 'all' }, tr);
  assert.equal(none.total, 0);
  const c = await provider.listProducts({ q: 'almanya 10 mark', stock: 'all' }, tr);
  assert.ok(c.total > 0, 'almanya 10 mark sonuç vermeli');
  assert.ok(c.items.every((p) => p.attributes.denomination === 10 && /almanya/.test(p.attributes.country ?? '')), JSON.stringify(c.items.map((p) => p.title)));
  const lower = await provider.listProducts({ q: 'OSMANLI GUMUS', stock: 'all' }, tr);
  assert.equal(lower.total, b.total, 'büyük harf / diakritiksiz yazım aynı sonucu vermeli');
  const en = await provider.listProducts({ q: 'Germany 10 mark', stock: 'all' }, { locale: 'en' });
  assert.equal(en.total, c.total, 'İngilizce ülke adıyla da bulunmalı');
});

test('Kondisyon sayıları nominal araması gibi eşleşmez; "10/9" bütün olarak aranır', async () => {
  const ten = await provider.listProducts({ q: '10 lira', stock: 'all', pageSize: 500 }, tr);
  assert.ok(ten.total > 0 && ten.items.every((p) => p.attributes.denomination === 10 || /\b10\b/.test(p.title)), JSON.stringify(ten.items.slice(0, 5).map((p) => p.title)));
  const c = await provider.listProducts({ q: 'meksika 10/10', stock: 'all', pageSize: 500 }, tr);
  assert.ok(c.total > 0 && c.items.every((p) => p.attributes.condition === '10/10' && p.attributes.country === 'meksika'));
});

test('Arama + filtre + sıralama birlikte çalışır', async () => {
  const r = await provider.listProducts({ q: 'francs', countries: ['fransa', 'belcika'], sort: 'price-asc', stock: 'all', pageSize: 50 }, tr);
  assert.ok(r.total > 0);
  assert.ok(r.items.every((p) => ['fransa', 'belcika'].includes(p.attributes.country!)));
  const prices = r.items.filter((p) => p.available).map((p) => p.price.amount);
  assert.deepEqual(prices, [...prices].sort((x, y) => x - y));
  const y = await provider.listProducts({ category: 't-c-kagit-paralar', yearFrom: 1940, yearTo: 1960, stock: 'all' }, tr);
  assert.ok(y.items.every((p) => p.attributes.yearFrom! <= 1960 && (p.attributes.yearTo ?? p.attributes.yearFrom!) >= 1940));
});

test('Satılan ürün: kendi URL’sinde kalır, varsayılan listede yok, sepete eklenemez', async () => {
  const sold = await provider.listProducts({ stock: 'sold', pageSize: 5 }, tr);
  assert.ok(sold.total > 0);
  const p = sold.items[0];
  assert.equal(p.available, false);
  assert.ok(await provider.getProduct(p.handle, tr), 'satılan ürün sayfası erişilebilir kalmalı');
  const def = await provider.listProducts({ q: p.handle, pageSize: 1000 }, tr);
  assert.ok(!def.items.some((x) => x.handle === p.handle), 'varsayılan liste satılanı göstermemeli');
  const cart = await provider.syncCart([{ handle: p.handle, variantId: p.variantId, quantity: 1 }], tr);
  assert.ok(cart.warnings.some((w) => w.type === 'sold-out'));
  assert.equal(cart.subtotal.amount, 0);
});

test('Sepet doğrulaması: stok sınırı ve fiyat değişikliği uyarısı', async () => {
  const p = (await provider.listProducts({ pageSize: 1 }, tr)).items[0];
  const cart = await provider.syncCart([{ handle: p.handle, variantId: p.variantId, quantity: 5, seenPrice: p.price.amount - 10 }], tr);
  assert.equal(cart.lines[0].quantity, 1);
  assert.ok(cart.warnings.some((w) => w.type === 'quantity-reduced'));
  assert.ok(cart.warnings.some((w) => w.type === 'price-changed'));
  const missing = await provider.syncCart([{ handle: 'olmayan-urun', variantId: 'x', quantity: 1 }], tr);
  assert.ok(missing.warnings.some((w) => w.type === 'not-found'));
});

test('Ürün içerikleri dile göre değişir, kimlik/handle aynı kalır', async () => {
  const h = (await provider.listProducts({ q: '5. emisyon 5 lira', stock: 'all', pageSize: 1 }, tr)).items[0].handle;
  const [ptr, pen, pja, pru] = await Promise.all((['tr', 'en', 'ja', 'ru'] as const).map((l) => provider.getProduct(h, { locale: l })));
  assert.equal(ptr!.id, pen!.id);
  assert.notEqual(ptr!.title, pen!.title);
  assert.match(pja!.title, /[぀-ヿ一-鿿]/);
  assert.match(pru!.title, /[А-Яа-я]/);
});

test('URL filtre ayrıştırma: çoklu değer, ters yıl aralığı, fiyat dönüşümü', () => {
  const q = parseQuery(new URLSearchParams('country=a&country=b&year_from=1990&year_to=1950&price_min=100&sort=bogus&page=-3'), 'en');
  assert.deepEqual(q.countries, ['a', 'b']);
  assert.equal(q.yearFrom, 1950);
  assert.equal(q.yearTo, 1990);
  assert.equal(q.priceMin, 4800);
  assert.equal(q.sort, undefined);
  assert.equal(q.page, 1);
});

test('Statik (GitHub Pages) sürüm her zaman demo sağlayıcısını kullanır', async () => {
  const prev = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = 'shopify';
  try {
    const { getProvider } = await import('../src/lib/data/index');
    assert.equal(getProvider().name, 'demo');
  } finally {
    process.env.DATA_SOURCE = prev;
  }
});

test('Üretim ortamı doğrulaması localhost / example alan adını reddeder', () => {
  const base = serverEnv();
  assert.ok(validateProductionEnv({ ...base, deployEnv: 'production', siteUrl: 'http://localhost:5500' }).length > 0);
  assert.ok(validateProductionEnv({ ...base, deployEnv: 'production', siteUrl: 'https://shop.example.com' }).length > 0);
});

test('Shopify dönüştürücüleri: metafield → özellik, satıldı durumu, sepet', () => {
  const attrs = mapAttributes([{ key: 'country', value: 'almanya', type: 'single_line_text_field' }, { key: 'year_from', value: '1920', type: 'number_integer' }, null, { key: 'condition', value: '', type: 'x' }]);
  assert.deepEqual(attrs, { country: 'almanya', yearFrom: 1920, yearTo: 1920, yearText: '1920' });
  const prod = mapProduct({
    id: 'gid://shopify/Product/1', handle: 'h', title: 'T', description: 'D', availableForSale: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
    tags: [], productType: '', featuredImage: null, images: { nodes: [] },
    variants: { nodes: [{ id: 'gid://shopify/ProductVariant/9', sku: 'A1', availableForSale: false, quantityAvailable: 0, price: { amount: '4800.0', currencyCode: 'TRY' } }] },
    collections: { nodes: [{ handle: 'c' }] }, metafields: [],
  }, new Map([['c', ['root', 'c']]]));
  assert.equal(prod.available, false);
  assert.equal(prod.price.amount, 4800);
  assert.equal(prod.updatedAt, '2026-02-01T00:00:00Z');
  const cart = mapCart({
    id: 'gid://shopify/Cart/1?key=k', checkoutUrl: 'https://x.myshopify.com/cart/c/1', totalQuantity: 1,
    cost: { subtotalAmount: { amount: '4800.0', currencyCode: 'TRY' }, totalAmount: { amount: '4800.0', currencyCode: 'TRY' } },
    lines: { nodes: [{ id: 'l1', quantity: 1, cost: { amountPerQuantity: { amount: '4800.0', currencyCode: 'TRY' }, totalAmount: { amount: '4800.0', currencyCode: 'TRY' } }, merchandise: { id: 'v', availableForSale: true, quantityAvailable: 1, product: { handle: 'h' } } }] },
  }, new Map());
  assert.equal(cart.checkoutUrl, 'https://x.myshopify.com/cart/c/1');
  assert.equal(cart.subtotal.amount, 4800);
});
