// Build/başlatma öncesi ortam doğrulaması. DEPLOY_ENV=production iken eksik/yanlış SITE_URL ile yayına çıkılmasını engeller.
import fs from 'node:fs';
if (fs.existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');
const env = process.env;
const deploy = env.DEPLOY_ENV || 'development';
const errors = [];
const warns = [];
if (deploy === 'production') {
  let u;
  try { u = new URL(env.SITE_URL || ''); } catch { errors.push('SITE_URL geçerli bir mutlak adres olmalı.'); }
  if (u) {
    if (u.protocol !== 'https:') errors.push('SITE_URL üretimde https:// olmalı.');
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname) || /(^|\.)example\.(com|org|net)$/.test(u.hostname) || /\.(test|localhost)$/.test(u.hostname)) errors.push(`SITE_URL üretim için geçersiz: ${u.hostname}`);
  }
  if (env.DATA_SOURCE === 'shopify' && (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN)) errors.push('Shopify modu için SHOPIFY_STORE_DOMAIN ve SHOPIFY_STOREFRONT_PRIVATE_TOKEN gerekli.');
  if (env.ALLOW_INDEXING !== 'true') warns.push('ALLOW_INDEXING=true değil: canlı sitede indeksleme kapalı kalacak.');
  if ((env.DATA_SOURCE || 'demo') === 'demo') warns.push('Üretimde DATA_SOURCE=demo: demo envanter yayında olacak.');
}
for (const k of Object.keys(env)) if (/^PUBLIC_.*(TOKEN|SECRET|KEY)/i.test(k)) errors.push(`${k}: gizli değerler PUBLIC_ önekiyle tanımlanmamalı (istemciye sızar).`);
warns.forEach((w) => console.warn('⚠', w));
if (errors.length) { errors.forEach((e) => console.error('✖', e)); process.exit(1); }
console.log(`✓ Ortam doğrulandı (DEPLOY_ENV=${deploy}, DATA_SOURCE=${env.DATA_SOURCE || 'demo'})`);
