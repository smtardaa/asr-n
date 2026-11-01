/**
 * GitHub Pages sürümü: sunucu olmadığı için yalnız DEMO sağlayıcısı kullanılır.
 * (Shopify Storefront bağlantısı sunucu gerektirir; ana projede DATA_SOURCE=shopify ile çalışır.)
 */
import { createDemoProvider } from './demo/provider';
import type { CatalogProvider } from './types';

let provider: CatalogProvider | null = null;

export function getProvider(): CatalogProvider {
  provider ??= createDemoProvider();
  return provider;
}

export function categoryTitle(c: { title: Record<string, string> | string }, locale: string): string {
  return typeof c.title === 'string' ? c.title : c.title[locale] ?? c.title.tr;
}

export * from './types';
