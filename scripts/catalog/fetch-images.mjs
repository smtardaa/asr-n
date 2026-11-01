// Demo ürün görsellerini kaynaktan indirir ve optimize eder.
// Kullanım: node scripts/catalog/fetch-images.mjs <ham-görsel-önbellek-klasörü> [--max=4]
// Çıktı: public/catalog/<handle>/<n>-<w>.webp  +  src/data/catalog/images.json (boyut ve kaynak kayıtları)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const cacheDir = process.argv[2];
if (!cacheDir) throw new Error('Önbellek klasörü verin');
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=4').split('=')[1]);
const SIZES = [640, 320];
const ROOT = process.cwd();
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/catalog/products.json'), 'utf8'));
const outJson = path.join(ROOT, 'src/data/catalog/images.json');
const existing = fs.existsSync(outJson) ? JSON.parse(fs.readFileSync(outJson, 'utf8')) : {};
fs.mkdirSync(cacheDir, { recursive: true });

async function download(url) {
  const key = crypto.createHash('md5').update(url).digest('hex');
  const file = path.join(cacheDir, key + '.bin');
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  const u = new URL(url);
  u.pathname = u.pathname.split('/').map((s) => encodeURIComponent(decodeURIComponent(s))).join('/');
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 ASRIN-demo-catalog' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) throw new Error('not image: ' + ct);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return buf;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

const result = { ...existing };
let done = 0, failed = 0;
const failures = [];

async function processProduct(p) {
  if (result[p.handle]?.length) { done++; return; }
  const urls = (p.sourceImageUrls || []).slice(0, MAX);
  const outDir = path.join(ROOT, 'public/catalog', p.handle);
  const list = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const buf = await download(urls[i]);
      fs.mkdirSync(outDir, { recursive: true });
      // Kenarlardaki düz beyaz dolguyu kırp, sonra kare tuval yerine orantıyı koru
      const trimmed = await sharp(buf).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true }).catch(() => null);
      const src = trimmed ? trimmed.data : buf;
      const meta = await sharp(src).metadata();
      const entry = { n: i + 1, source: urls[i], files: {} };
      for (const w of SIZES) {
        const file = `${i + 1}-${w}.webp`;
        const info = await sharp(src).resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 74, effort: 4 }).toFile(path.join(outDir, file));
        entry.files[w] = { file: `/catalog/${p.handle}/${file}`, width: info.width, height: info.height };
      }
      entry.width = meta.width; entry.height = meta.height;
      list.push(entry);
    } catch (e) {
      failed++;
      failures.push({ handle: p.handle, url: urls[i], error: String(e.message || e) });
    }
  }
  result[p.handle] = list;
  done++;
  if (done % 50 === 0) {
    console.log(`${done}/${products.length} (hata: ${failed})`);
    fs.writeFileSync(outJson, JSON.stringify(result));
  }
}

const queue = [...products];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await processProduct(queue.shift()); }));
fs.writeFileSync(outJson, JSON.stringify(result));
fs.writeFileSync(path.join(ROOT, 'src/data/catalog/images-report.json'), JSON.stringify({ products: products.length, failed, failures }, null, 1));
console.log('bitti', done, 'hata', failed);
