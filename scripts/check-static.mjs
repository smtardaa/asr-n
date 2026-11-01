// GitHub Pages çıktısı (dist/) denetimi: sayfa sayısı, alt yol (BASE_PATH), iç bağlantı/görsel bütünlüğü,
// canonical/hreflang, noindex, sitemap, istemci verisi ve demo fiyat kuralı.
// Kullanım: BASE_PATH=/depo-adi npm run check:static   (build ile aynı BASE_PATH verilmelidir)
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const DIST = 'dist';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✖', m); } };
if (!fs.existsSync(DIST)) { console.error('dist/ yok — önce npm run build'); process.exit(1); }

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIST).map((f) => f.split(path.sep).join('/'));
const fileSet = new Set(files.map((f) => f.slice(DIST.length)));
const html = files.filter((f) => f.endsWith('.html'));
const products = JSON.parse(fs.readFileSync('src/data/catalog/products.json', 'utf8'));
const categories = JSON.parse(fs.readFileSync('src/data/catalog/categories.json', 'utf8'));
const read = (rel) => fs.readFileSync(path.join(DIST, rel), 'utf8');
console.log(`Statik çıktı denetimi — BASE=${BASE}, ${html.length} HTML dosyası`);

console.log('\n[Sayfa kapsamı]');
const expected = (18 + categories.length + products.length) * 4;
const pages = html.filter((f) => f.endsWith('/index.html'));
ok(pages.length === expected, `${pages.length} sayfa (beklenen ${expected} = (18 sabit + ${categories.length} kategori + ${products.length} ürün) × 4 dil)`);
ok(fileSet.has('/404.html'), '404.html var (GitHub Pages bilinmeyen yollar için kullanır)');
for (const l of ['tr', 'en', 'ja', 'ru']) ok(fileSet.has(`/data/catalog-${l}.json`) && JSON.parse(read(`data/catalog-${l}.json`)).items.length === products.length, `İstemci katalog verisi: data/catalog-${l}.json (${products.length} ürün)`);

console.log('\n[İç bağlantı ve görsel bütünlüğü — tüm sayfalar]');
const resolve = (u) => {
  const p = u.split('#')[0].split('?')[0];
  if (!p.startsWith(BASE)) return null;
  let rel = '/' + decodeURIComponent(p.slice(BASE.length));
  if (rel.endsWith('/')) rel += 'index.html';
  return rel;
};
let checked = 0; const broken = new Map(); const rootLinks = new Set();
for (const f of html) {
  const h = fs.readFileSync(f, 'utf8');
  const refs = [...h.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const m of h.matchAll(/srcset="([^"]+)"/g)) m[1].split(',').forEach((x) => refs.push(x.trim().split(/\s+/)[0]));
  for (const r0 of refs) {
    const r = r0.replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(r)) continue;
    if (!r.startsWith('/')) continue;
    if (BASE !== '/' && !r.startsWith(BASE)) { rootLinks.add(r); continue; }
    const rel = resolve(r); checked++;
    if (rel && !fileSet.has(rel)) broken.set(r, f.slice(DIST.length));
  }
}
ok(broken.size === 0, `${checked} iç bağlantı/görsel referansı dosyaya karşılık geliyor ${[...broken].slice(0, 5).map(([k, v]) => `${k} (${v})`).join(' ')}`);
ok(rootLinks.size === 0, `Alt yolu (BASE) atlayan kök bağlantı yok ${[...rootLinks].slice(0, 5).join(' ')}`);

console.log('\n[SEO ve dil]');
const p4800 = products.find((p) => p.price.amount === 4800 && !p.demoSold);
const enP = read(`en/product/${p4800.handle}/index.html`);
ok(enP.includes('$100.00') && /<html lang="en"/.test(enP), '4.800 TL → EN sayfada $100.00, lang=en');
ok(/<link rel="canonical" href="[^"]*\/en\/product\/[^"]+\/"/.test(enP) && enP.includes(`${BASE}en/product/`), 'Canonical alt yol + sondaki "/" ile kendini gösteriyor');
const hl = [...enP.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((m) => m[1]).sort().join(',');
ok(hl === 'en,ja,ru,tr,x-default', 'hreflang tr/en/ja/ru + x-default');
ok(/content="noindex, nofollow"/.test(enP), 'Demo noindex meta etiketi');
for (const [rel, lang] of [['index.html', 'tr'], ['en/index.html', 'en'], ['ja/index.html', 'ja'], ['ru/index.html', 'ru']]) ok(new RegExp(`<html lang="${lang}"`).test(read(rel)), `${BASE}${rel.replace('index.html', '')} → lang=${lang}`);
const sold = products.find((p) => p.demoSold);
const sp = read(`urun/${sold.handle}/index.html`);
const info = sp.slice(sp.indexOf('class="product-info"'), sp.indexOf('id="similar"'));
ok(info.includes('tag-sold') && !info.includes('data-add-to-cart='), 'Satılan ürün sayfası: Satıldı etiketi, sepete ekle yok');
const sm = read('sitemap.xml');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok(locs.length === expected - 4 * 3 && locs.every((l) => l.includes(BASE)), `Sitemap ${locs.length} URL (sepet/arama/favoriler hariç), hepsi alt yol içeriyor`);
ok(read('robots.txt').includes('Disallow: /'), 'robots.txt demo’da engelli');

console.log('\n[Sunucu bağımlılığı kalmadı]');
const js = files.filter((f) => f.endsWith('.js'));
const apiRefs = js.filter((f) => /\/api\/cart|\/api\/shopify/.test(fs.readFileSync(f, 'utf8')));
ok(apiRefs.length === 0, `İstemci JS’inde /api çağrısı yok (${js.length} dosya)`);
const secrets = files.filter((f) => /\.(js|html|json)$/.test(f) && /Shopify-Storefront-Private-Token|SHOPIFY_STOREFRONT_PRIVATE_TOKEN|merchant_key|merchant_salt/.test(fs.readFileSync(f, 'utf8')));
ok(secrets.length === 0, 'Çıktıda gizli anahtar adı/başlığı yok');

const size = files.reduce((s, f) => s + fs.statSync(f).size, 0);
ok(size < 1e9, `Toplam boyut ${(size / 1e6).toFixed(0)} MB (GitHub Pages sınırı 1 GB)`);
console.log(`\nSonuç: ${pass} başarılı, ${fail} başarısız`);
process.exit(fail ? 1 : 0);
