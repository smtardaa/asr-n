// Pegasus'lu ASRIN logosundan site varlıklarını üretir (oran korunur, kırpma/germe yok).
import sharp from 'sharp';
import fs from 'node:fs';
const src = fs.readdirSync('.').find((f) => /^ASRIN logo/i.test(f));
const out = 'public/brand';
fs.mkdirSync(out, { recursive: true });
const img = sharp(src);
const meta = await img.metadata();
console.log('logo', meta.width, meta.height);
for (const s of [96, 192, 384]) {
  await sharp(src).resize(s, s, { fit: 'contain' }).webp({ quality: 88 }).toFile(`${out}/logo-${s}.webp`);
}
await sharp(src).resize(512, 512, { fit: 'contain' }).png({ compressionLevel: 9 }).toFile(`${out}/logo-512.png`);
await sharp(src).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await sharp(src).resize(48, 48).png().toFile(`${out}/favicon-48.png`);
await sharp(src).resize(32, 32).png().toFile('public/favicon-32.png');
// Varsayılan paylaşım görseli 1200x630: bordo zemin + altın ışık + logo
const logo = await sharp(src).resize(470, 470).png().toBuffer();
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#8a1420"/><stop offset=".55" stop-color="#4d0810"/><stop offset="1" stop-color="#25030a"/></radialGradient>
<radialGradient id="l" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f5d675" stop-opacity=".35"/><stop offset="1" stop-color="#f5d675" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/><circle cx="600" cy="315" r="330" fill="url(#l)"/>
<rect x="24" y="24" width="1152" height="582" fill="none" stroke="#d4af37" stroke-opacity=".55" stroke-width="2"/></svg>`);
await sharp(bg).composite([{ input: logo, left: 365, top: 80 }]).jpeg({ quality: 84, mozjpeg: true }).toFile(`${out}/og-default.jpg`);
console.log('ok');
