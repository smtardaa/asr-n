/**
 * GitHub Pages: tarayıcıdaki arama, filtre, sepet ve favoriler için dil başına katalog dosyası (build sırasında üretilir).
 * Fiyat metinleri sunucu sürümüyle aynı fonksiyonla (priceView) hesaplanır; kart, detay ve sepet aynı biçimi kullanır.
 */
import type { APIRoute } from 'astro';
import { LOCALES, type Locale } from '../../config/site';
import { dict, pathFor } from '../../i18n';
import { createDemoProvider, searchExtraFor } from '../../lib/data/demo/provider';
import { serverEnv } from '../../lib/env';
import { conditionLabel, makeLabels } from '../../lib/labels';
import { priceView } from '../../lib/money';
import { productMeta, type PageCtx } from '../../lib/page';

export const prerender = true;

export function getStaticPaths() {
  return LOCALES.map((locale) => ({ params: { locale } }));
}

export const GET: APIRoute = async ({ params }) => {
  const locale = params.locale as Locale;
  const provider = createDemoProvider();
  const ctx = { locale };
  const env = serverEnv();
  const pricing = { mode: 'demo' as const, checkoutTryOnly: env.checkoutTryOnly };
  const categories = await provider.getCategories(ctx);
  const labels = makeLabels(locale, categories);
  const handles = (await provider.listAllProductHandles(ctx)).map((h) => h.handle);
  const products = await provider.getProductsByHandles(handles, ctx);
  const metaCtx = { t: dict(locale), locale } as unknown as PageCtx;
  const items = products.map((p) => {
    const pv = priceView(p.price, locale, pricing);
    const img = p.images[0];
    return {
      h: p.handle,
      v: p.variantId,
      t: p.title,
      u: pathFor(locale, 'product', p.handle),
      img: img ? [img.thumbUrl ?? img.url, img.url, img.width, img.height, img.alt] : null,
      m: productMeta(p, metaCtx, labels.country),
      cl: p.attributes.condition ? conditionLabel(p.attributes.condition, locale) : '',
      s: p.sku ?? '',
      p: p.price.amount,
      pt: pv.text,
      pa: pv.approximate,
      pc: pv.approximate ? pv.chargeText ?? null : null,
      a: p.available,
      q: p.quantityAvailable ?? 10,
      n: p.newness,
      nw: !!p.isNew,
      c: p.categories.map((c) => c.handle),
      at: p.attributes,
      x: searchExtraFor(p.handle),
    };
  });
  const body = {
    locale,
    categories: categories.map((c) => ({ h: c.handle, p: c.parent ?? null })),
    items,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
