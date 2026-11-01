// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';

// GitHub Pages sürümü: sunucu yok, tüm sayfalar build sırasında statik dosyaya dönüştürülür.
// SITE_URL (yalnız köken, ör. https://kullanici.github.io) ve BASE_PATH (ör. /depo-adi) değerlerini
// GitHub Actions iş akışı (actions/configure-pages) otomatik verir. Yerelde .env veya varsayılanlar kullanılır.
if (fs.existsSync('.env') && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env'); } catch { /* yok say */ }
}

const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'http://localhost:5501',
  base,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  server: { port: 5501, host: true },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
});
