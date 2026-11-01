/**
 * Shopify Storefront API istemcisi — YALNIZCA SUNUCUDA çalışır.
 * Özel (private) erişim anahtarı "Shopify-Storefront-Private-Token" başlığıyla gönderilir; tarayıcıya hiçbir zaman iletilmez.
 * Belge: https://shopify.dev/docs/api/storefront (sürüm .env → SHOPIFY_STOREFRONT_API_VERSION, varsayılan 2026-10)
 */
import { serverEnv } from '../../env';
import { DataSourceError } from '../types';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

export async function storefront<T>(query: string, variables: Record<string, unknown> = {}, opts: { buyerIp?: string; timeoutMs?: number } = {}): Promise<T> {
  const env = serverEnv().shopify;
  if (!env.domain || !env.privateToken) {
    throw new DataSourceError('Shopify bağlantısı yapılandırılmamış (SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_PRIVATE_TOKEN).', 'config');
  }
  const url = `https://${env.domain}/api/${env.apiVersion}/graphql.json`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Shopify-Storefront-Private-Token': env.privateToken,
  };
  // Ziyaretçi kaynaklı isteklerde alıcı IP'si iletilir (Shopify bot koruması için önerilir)
  if (opts.buyerIp) headers['Shopify-Storefront-Buyer-IP'] = opts.buyerIp;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10000);
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, variables }), signal: ctrl.signal });
  } catch (e) {
    throw new DataSourceError('Shopify Storefront API isteği başarısız oldu (ağ/zaman aşımı).', 'network', String(e));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new DataSourceError(`Shopify Storefront API HTTP ${res.status}`, res.status === 401 || res.status === 403 ? 'config' : 'api');
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new DataSourceError(`Shopify GraphQL hatası: ${json.errors.map((e) => e.message).join('; ')}`, 'api', json.errors);
  }
  if (!json.data) throw new DataSourceError('Shopify boş yanıt döndürdü.', 'api');
  return json.data;
}

/* ── Basit TTL önbellek (yalnızca liste/dizin verisi için; ürün detayı ve sepet canlı sorgulanır) ── */
const store = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as T;
  const value = await load();
  store.set(key, { at: Date.now(), value });
  return value;
}

/** Webhook veya /api/revalidate çağrısıyla tüm dizin önbelleğini temizler. */
export function clearShopifyCache(): number {
  const n = store.size;
  store.clear();
  return n;
}

export function cacheInfo() {
  return [...store.entries()].map(([k, v]) => ({ key: k, ageSeconds: Math.round((Date.now() - v.at) / 1000) }));
}
