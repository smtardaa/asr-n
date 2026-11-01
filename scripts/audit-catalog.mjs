// Demo katalog bütünlük denetimi: kimlik/slug çakışması, fiyat, kategori bağlantısı, görsel dosyalarının gerçekten çözülebilir WebP olması.
import fs from 'node:fs';
import sharp from 'sharp';
const P = JSON.parse(fs.readFileSync('src/data/catalog/products.json', 'utf8'));
const C = JSON.parse(fs.readFileSync('src/data/catalog/categories.json', 'utf8'));
const I = JSON.parse(fs.readFileSync('src/data/catalog/images.json', 'utf8'));
const issues = [];
const dup = (arr, k) => { const s = new Map(); arr.forEach((x) => s.set(x[k], (s.get(x[k]) || 0) + 1)); return [...s].filter(([, n]) => n > 1).map(([v]) => v); };
const dupIds = dup(P, 'id'), dupHandles = dup(P, 'handle'), dupCats = dup(C, 'handle');
const catSet = new Set(C.map((c) => c.handle));
const clash = P.filter((p) => catSet.has(p.handle)).length; // farklı URL önekleri nedeniyle sorun değil, bilgi amaçlı
const badPrice = P.filter((p) => !(typeof p.price?.amount === 'number' && p.price.amount > 0));
const badCat = P.filter((p) => !p.categories.length || p.categories.some((h) => !catSet.has(h)));
const badParent = C.filter((c) => c.parent && !catSet.has(c.parent));
const noTitle = P.filter((p) => ['tr', 'en', 'ja', 'ru'].some((l) => !p.title?.[l]?.trim() || !p.description?.[l]?.trim()));
const noImgs = P.filter((p) => !(I[p.handle]?.length));
let files = 0, broken = [];
for (const [h, list] of Object.entries(I)) for (const im of list) for (const f of Object.values(im.files)) {
  files++;
  const path = 'public' + f.file;
  try {
    const st = fs.statSync(path);
    if (st.size < 200) { broken.push(`${path} (${st.size} B)`); continue; }
    const m = await sharp(path).metadata();
    if (m.format !== 'webp' || m.width !== f.width || m.height !== f.height) broken.push(`${path} (format/boyut uyuşmuyor)`);
  } catch (e) { broken.push(`${path} (${e.code || e.message})`); }
}
const orphanDirs = fs.readdirSync('public/catalog').filter((d) => !I[d]);
const r = {
  products: P.length, categories: C.length, rootCategories: C.filter((c) => !c.parent).length,
  categoriesWithProducts: C.filter((c) => c.productCount > 0).length, demoSold: P.filter((p) => p.demoSold).length,
  dupIds, dupHandles, dupCats, productHandleAlsoCategoryHandle: clash,
  badPrice: badPrice.map((p) => p.handle), badCategory: badCat.map((p) => p.handle), badParent: badParent.map((c) => c.handle),
  missingTranslations: noTitle.map((p) => p.handle), productsWithoutImages: noImgs.map((p) => p.handle),
  imageFiles: files, brokenImages: broken, orphanImageDirs: orphanDirs,
};
console.log(JSON.stringify(r, null, 1));
const fail = dupIds.length + dupHandles.length + dupCats.length + badPrice.length + badCat.length + badParent.length + noTitle.length + noImgs.length + broken.length;
process.exit(fail ? 1 : 0);
