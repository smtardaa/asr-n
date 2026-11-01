/**
 * Sunucu tarafı ortam değişkenleri. Bu modül yalnızca SSR kodundan içe aktarılmalıdır.
 * Değerler çalışma anında process.env'den okunur; derleme çıktısına gömülmez.
 */
const read = (key: string): string => (process.env[key] ?? '').trim();
const bool = (key: string, fallback = false): boolean => {
  const v = read(key).toLowerCase();
  if (!v) return fallback;
  return v === 'true' || v === '1' || v === 'yes';
};

export type DataSource = 'demo' | 'shopify';
export type DeployEnv = 'development' | 'staging' | 'production';

export function serverEnv() {
  // GitHub Pages sürümünde sunucu yoktur; veri kaynağı her zaman demo'dur
  const dataSource = 'demo' as DataSource;
  const deployEnv = (read('DEPLOY_ENV') || 'development') as DeployEnv;
  const showDemoRaw = read('SHOW_DEMO_NOTICE');
  return {
    siteUrl: (read('SITE_URL') || 'http://localhost:5500').replace(/\/+$/, ''),
    deployEnv,
    allowIndexing: deployEnv === 'production' && bool('ALLOW_INDEXING'),
    dataSource,
    showDemoNotice: showDemoRaw ? bool('SHOW_DEMO_NOTICE') : dataSource !== 'shopify',
    checkoutTryOnly: bool('CHECKOUT_CURRENCY_TRY_ONLY', true),
    shopify: {
      domain: read('SHOPIFY_STORE_DOMAIN').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      apiVersion: read('SHOPIFY_STOREFRONT_API_VERSION') || '2026-10',
      privateToken: read('SHOPIFY_STOREFRONT_PRIVATE_TOKEN'),
      cacheTtl: Math.max(0, Number(read('SHOPIFY_CATALOG_CACHE_TTL') || 300)),
      webhookSecret: read('SHOPIFY_WEBHOOK_SECRET'),
    },
    revalidateToken: read('REVALIDATE_TOKEN'),
  } as const;
}

export type ServerEnv = ReturnType<typeof serverEnv>;

/** Üretim ortamı için yapılandırma hatalarını döndürür (boş dizi = sorun yok). */
export function validateProductionEnv(env: ServerEnv = serverEnv()): string[] {
  const errors: string[] = [];
  if (env.deployEnv !== 'production') return errors;
  let host = '';
  try {
    const u = new URL(env.siteUrl);
    host = u.hostname;
    if (u.protocol !== 'https:') errors.push('SITE_URL üretimde https:// ile başlamalı.');
  } catch {
    errors.push('SITE_URL geçerli bir adres değil.');
  }
  if (!read('SITE_URL')) errors.push('SITE_URL tanımlı değil.');
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host) || /(^|\.)example\.(com|org|net)$/.test(host) || host.endsWith('.test') || host.endsWith('.localhost')) {
    errors.push(`SITE_URL üretim için geçersiz bir alan adı içeriyor: ${host}`);
  }
  if (env.dataSource === 'shopify') {
    if (!env.shopify.domain) errors.push('SHOPIFY_STORE_DOMAIN tanımlı değil.');
    if (!env.shopify.privateToken) errors.push('SHOPIFY_STOREFRONT_PRIVATE_TOKEN tanımlı değil.');
  }
  return errors;
}
