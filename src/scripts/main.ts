/**
 * İstemci betiği (vanilla JS). Sunucu HTML'i JS olmadan da okunur; bu betik yalnızca etkileşim ekler.
 * Sepet ve favoriler localStorage'da tutulur (erişilemezse bellekte). Fiyat/stok her zaman sunucudan doğrulanır.
 */
type Line = { handle: string; variantId: string; quantity: number; seenPrice?: number };
type CartState = { lines: Line[]; cartId?: string };
import { initListing, localCart, renderFavorites, type CardStrings } from './static-store';
import type { Locale } from '../config/site';

interface Config { locale: Locale; intl: string; cartPath: string; dataUrl: string; mode: 'demo' | 'shopify'; t: Record<string, string> }

const cfg: Config = JSON.parse(document.getElementById('asrin-config')?.textContent || '{}');
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel as any) as T | null;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel as any)) as T[];

/* ───────── Güvenli depolama ───────── */
const mem = new Map<string, string>();
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return mem.get(k) ?? null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { mem.set(k, v); } },
};
const CART_KEY = 'asrin.cart.v1';
const FAV_KEY = 'asrin.fav.v1';

export function readCart(): CartState {
  try {
    const v = JSON.parse(store.get(CART_KEY) || '{}');
    return { lines: Array.isArray(v.lines) ? v.lines.filter((l: Line) => l && l.handle) : [], cartId: v.cartId };
  } catch { return { lines: [] }; }
}
function writeCart(c: CartState) { store.set(CART_KEY, JSON.stringify(c)); updateBadges(); }
function readFavs(): string[] { try { const v = JSON.parse(store.get(FAV_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } }
function writeFavs(f: string[]) { store.set(FAV_KEY, JSON.stringify([...new Set(f)].slice(0, 200))); updateBadges(); }

/* ───────── Toast ───────── */
let toastTimer: number | undefined;
function toast(msg: string) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.show = 'true';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.dataset.show = 'false'; }, 2600);
}

/* ───────── Rozetler ───────── */
function updateBadges() {
  const n = readCart().lines.reduce((s, l) => s + (l.quantity || 0), 0);
  $$('[data-cart-count]').forEach((b) => { b.textContent = String(n); b.hidden = n === 0; });
  $$('[data-cart-link]').forEach((a) => a.setAttribute('aria-label', n ? `${cfg.t.cartLabel} (${n})` : cfg.t.cartLabel));
  const f = readFavs();
  $$('[data-fav-count]').forEach((b) => { b.textContent = String(f.length); b.hidden = f.length === 0; });
  $$<HTMLButtonElement>('[data-fav]').forEach((btn) => {
    const on = f.includes(btn.dataset.fav!);
    btn.setAttribute('aria-pressed', String(on));
    const base = btn.getAttribute('aria-label')?.split(': ').slice(1).join(': ');
    btn.setAttribute('aria-label', (on ? cfg.t.favRemove : cfg.t.favAdd) + (base ? `: ${base}` : ''));
  });
}
window.addEventListener('storage', (e) => { if (e.key === CART_KEY || e.key === FAV_KEY) updateBadges(); });

/* ───────── Sepete ekle / favori ───────── */
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const addBtn = target.closest<HTMLButtonElement>('[data-add-to-cart]');
  if (addBtn) {
    const d = JSON.parse(addBtn.dataset.addToCart!);
    const cart = readCart();
    const line = cart.lines.find((l) => l.handle === d.handle);
    const max = Number(d.max) || 10;
    if (line && line.quantity >= max) { toast(cfg.t.alreadyMax); return; }
    if (line) line.quantity += 1;
    else cart.lines.push({ handle: d.handle, variantId: d.variantId, quantity: 1, seenPrice: d.price });
    writeCart(cart);
    addBtn.dataset.added = 'true';
    toast(cfg.t.added);
    return;
  }
  const favBtn = target.closest<HTMLButtonElement>('[data-fav]');
  if (favBtn) {
    const h = favBtn.dataset.fav!;
    const f = readFavs();
    writeFavs(f.includes(h) ? f.filter((x) => x !== h) : [...f, h]);
    if ($('[data-favorites-page]') && f.includes(h)) showFavorites();
  }
});

/* ───────── Açılır menüler (dil, koleksiyon) ───────── */
function setupDisclosure(btn: HTMLElement, panel: HTMLElement, opts: { useHidden?: boolean; itemsSel?: string } = {}) {
  const open = (focusFirst = false) => {
    btn.setAttribute('aria-expanded', 'true');
    if (opts.useHidden) panel.hidden = false; else panel.dataset.open = 'true';
    if (focusFirst && opts.itemsSel) $$(opts.itemsSel, panel)[0]?.focus();
  };
  const close = (refocus = false) => {
    btn.setAttribute('aria-expanded', 'false');
    if (opts.useHidden) panel.hidden = true; else panel.dataset.open = 'false';
    if (refocus) btn.focus();
  };
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && opts.itemsSel) { e.preventDefault(); open(true); }
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (!opts.itemsSel || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End')) return;
    const items = $$(opts.itemsSel, panel);
    const i = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  });
  document.addEventListener('click', (e) => { if (isOpen() && !btn.contains(e.target as Node) && !panel.contains(e.target as Node)) close(); });
  btn.parentElement?.addEventListener('focusout', (e) => { if (isOpen() && !btn.parentElement!.contains(e.relatedTarget as Node)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(true); });
}
const langBtn = $('[data-lang-btn]'), langMenu = $('[data-lang-menu]');
if (langBtn && langMenu) setupDisclosure(langBtn, langMenu, { useHidden: true, itemsSel: '[data-lang-option]' });
const megaBtn = $('[data-mega-trigger]'), mega = $('[data-mega]');
if (megaBtn && mega) setupDisclosure(megaBtn, mega);

/* ───────── Mobil menü ───────── */
const panel = $('[data-mobile-panel]');
const openers = $$('[data-menu-open]');
if (panel) {
  const sheet = $('.sheet', panel)!;
  const close = () => {
    panel.dataset.open = 'false'; panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    openers.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    openers[0]?.focus();
  };
  openers.forEach((o) => o.addEventListener('click', () => {
    panel.dataset.open = 'true'; panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    o.setAttribute('aria-expanded', 'true');
    $<HTMLElement>('a, button, summary', sheet)?.focus();
  }));
  $$('[data-menu-close]', panel).forEach((b) => b.addEventListener('click', close));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // basit odak tuzağı
      const f = $$<HTMLElement>('a, button, summary, input', sheet).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
}

/* ───────── Ana sayfa sekmeleri ───────── */
const tabList = $('[data-home-tabs]');
if (tabList) {
  const tabs = $$<HTMLButtonElement>('[role="tab"]', tabList);
  const grid = $('#new-grid')!;
  const select = (tab: HTMLButtonElement, focus = false) => {
    tabs.forEach((x) => { x.setAttribute('aria-selected', String(x === tab)); x.tabIndex = x === tab ? 0 : -1; });
    grid.setAttribute('aria-labelledby', tab.id);
    let shown = 0;
    $$('li[data-tabs]', grid).forEach((li) => {
      const ok = li.dataset.tabs!.split(' ').includes(tab.dataset.tab!) && shown < 8;
      li.hidden = !ok;
      if (ok) shown++;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true); }
    });
  });
}

/* ───────── Filtreler ───────── */
const form = $<HTMLFormElement>('[data-filter-form]');
if (form) {
  const desktop = window.matchMedia('(min-width: 901px)');
  // Boş parametreleri URL'ye yazma (temiz, paylaşılabilir bağlantılar)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === 'string' && v.trim() !== '' && k !== 'page') sp.append(k, v.trim());
    if (sp.get('sort') === 'newest' && !sp.get('q')) sp.delete('sort');
    if (sp.get('sort') === 'relevance' && sp.get('q')) sp.delete('sort');
    const s = sp.toString();
    location.assign(form.action.split('?')[0] + (s ? `?${s}` : ''));
  });
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (desktop.matches && (el.type === 'checkbox' || el.type === 'radio')) form.requestSubmit();
  });
  $('[data-sort-select]')?.addEventListener('change', () => {
    $$<HTMLInputElement>('[data-sort-mirror]', form).forEach((m) => m.remove());
    form.requestSubmit();
  });
  const filters = $('[data-filters]')!, scrim = $('[data-filters-scrim]');
  const openBtn = $('[data-filters-open]');
  const closeF = () => { filters.dataset.open = 'false'; if (scrim) scrim.hidden = true; openBtn?.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; openBtn?.focus(); };
  openBtn?.addEventListener('click', () => {
    filters.dataset.open = 'true'; if (scrim) scrim.hidden = false; openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    $<HTMLElement>('input, a, button', filters)?.focus();
  });
  $('[data-filters-close]')?.addEventListener('click', closeF);
  scrim?.addEventListener('click', closeF);
  filters.addEventListener('keydown', (e) => { if (e.key === 'Escape' && filters.dataset.open === 'true') closeF(); });
}

/* ───────── Ürün galerisi ve yakınlaştırma ───────── */
const gallery = $('[data-gallery]');
if (gallery) {
  const mainImg = $<HTMLImageElement>('[data-gallery-main]', gallery);
  const dialog = $<HTMLDialogElement>('[data-zoom-dialog]', gallery);
  const zImg = $<HTMLImageElement>('[data-zoom-img]', gallery);
  const stage = $('[data-zoom-stage]', gallery);
  $$<HTMLButtonElement>('[data-thumb]', gallery).forEach((b) => b.addEventListener('click', () => {
    if (!mainImg) return;
    mainImg.src = b.dataset.src!; mainImg.alt = b.dataset.alt!; mainImg.width = Number(b.dataset.w); mainImg.height = Number(b.dataset.h);
    $$('[data-thumb]', gallery).forEach((x) => x.setAttribute('aria-current', String(x === b)));
  }));
  $('[data-zoom-open]', gallery)?.addEventListener('click', () => {
    if (!dialog || !zImg || !mainImg) return;
    zImg.src = mainImg.src; zImg.alt = mainImg.alt;
    $('[data-zoom-caption]', gallery)!.textContent = mainImg.alt;
    stage?.classList.remove('is-zoomed');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else window.open(mainImg.src, '_blank');
  });
  const toggle = () => stage?.classList.toggle('is-zoomed');
  stage?.addEventListener('click', toggle);
  $('[data-zoom-toggle]', gallery)?.addEventListener('click', toggle);
  $('[data-zoom-close]', gallery)?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}

/* ───────── Favoriler sayfası ───────── */
function showFavorites() {
  const S: CardStrings = JSON.parse($('#card-strings')?.textContent || '{}');
  renderFavorites(readFavs(), cfg.dataUrl, S, updateBadges).catch(() => { const e = $('[data-fav-empty]'); if (e) e.hidden = false; });
}
if ($('[data-favorites-page]')) showFavorites();

/* ───────── Listeleme / arama (filtreler tarayıcıda uygulanır) ───────── */
initListing(cfg.locale, cfg.intl, cfg.dataUrl, updateBadges);

/* ───────── Dil değişiminde filtre/arama parametrelerini koru ───────── */
if (location.search) {
  $$<HTMLAnchorElement>('[data-lang-option]').forEach((a) => { if (!a.href.includes('?')) a.href += location.search; });
}

/* ───────── Sepet sayfası ───────── */
const cartPage = $('[data-cart-page]');
if (cartPage) {
  const root: HTMLElement = cartPage;
  const S: Record<string, string> = JSON.parse($('#cart-strings')?.textContent || '{}');
  const list = $('[data-cart-lines]', cartPage)!;
  const status = $('[data-cart-status]', cartPage)!;
  const empty = $('[data-cart-empty]', cartPage)!;
  const summary = $('[data-cart-summary]', cartPage)!;
  const checkoutBtn = $<HTMLButtonElement>('[data-checkout]', cartPage)!;
  const alertBox = $('[data-cart-alert]', cartPage)!;
  let busy = false;

  const el = (tag: string, attrs: Record<string, string> = {}, text?: string) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const setAlert = (msg: string, kind = 'warn') => { alertBox.replaceChildren(); if (msg) alertBox.append(el('p', { class: `notice notice-${kind}`, role: 'alert' }, msg)); };

  async function sync() {
    const state = readCart();
    if (!state.lines.length) { list.replaceChildren(); empty.hidden = false; summary.hidden = true; status.textContent = ''; return; }
    status.textContent = status.textContent || '';
    try {
      // Statik sürüm: doğrulama tarayıcıda, build sırasında üretilen katalog verisiyle
      const data = await localCart(state.lines, cfg.locale, cfg.dataUrl, { warnSoldOut: S.warnSoldOut, warnQty: S.warnQty, warnPrice: S.warnPrice, warnMissing: S.warnMissing, chargeLabel: S.chargeLabel });
      render(data);
      // Kaldırılmış ürünleri ve sunucunun düzelttiği adetleri yerel sepete yansıt; görülen fiyatı güncelle
      const next: CartState = { cartId: data.cartId, lines: state.lines.filter((l) => !data.missing.some((m: { handle: string }) => m.handle === l.handle)).map((l) => {
        const s = data.lines.find((x: { handle: string }) => x.handle === l.handle);
        return s ? { ...l, quantity: s.quantity, variantId: s.variantId || l.variantId, seenPrice: s.unitPrice } : l;
      }) };
      writeCart(next);
      status.textContent = '';
      return data;
    } catch (err) {
      status.textContent = '';
      setAlert(`${S.errorTitle}. ${(err as Error).message}`, 'error');
    }
  }

  function render(data: any) {
    list.replaceChildren();
    empty.hidden = data.lines.length > 0 || data.missing.length > 0;
    summary.hidden = data.lines.length === 0;
    for (const m of data.missing) list.append(el('li', { class: 'notice notice-warn' }, `${m.handle}: ${m.text}`));
    for (const l of data.lines) {
      const li = el('li', { class: 'cart-line' });
      if (l.image) { const img = el('img', { src: l.image, alt: l.imageAlt, width: '96', height: '80', loading: 'lazy' }); li.append(img); } else li.append(el('span'));
      const mid = el('div');
      const h = el('h2'); const a = el('a', { href: l.url }, l.title); h.append(a); mid.append(h);
      mid.append(el('p', { class: 'line-meta', style: 'margin:0' }, [l.meta, `${S.quantity}: ${l.quantity}`, l.unitText].filter(Boolean).join(' · ')));
      li.append(mid);
      const right = el('div', { class: 'line-right' });
      if (l.available) {
        const q = el('div', { class: 'qty', role: 'group', 'aria-label': `${S.quantity}: ${l.title}` });
        const minus = el('button', { type: 'button', 'aria-label': '−' }, '−');
        const input = el('input', { type: 'number', min: '1', max: String(l.max), value: String(l.quantity), inputmode: 'numeric', 'aria-label': S.quantity }) as HTMLInputElement;
        const plus = el('button', { type: 'button', 'aria-label': '+' }, '+');
        if (l.quantity <= 1) minus.setAttribute('disabled', '');
        if (l.quantity >= l.max) plus.setAttribute('disabled', '');
        minus.addEventListener('click', () => setQty(l.handle, l.quantity - 1));
        plus.addEventListener('click', () => setQty(l.handle, l.quantity + 1));
        input.addEventListener('change', () => setQty(l.handle, Math.max(1, Math.min(l.max, Number(input.value) || 1))));
        q.append(minus, input, plus);
        right.append(q);
      } else {
        right.append(el('span', { class: 'tag tag-sold' }, S.sold));
      }
      right.append(el('strong', { class: 'price' }, l.lineText));
      const rm = el('button', { type: 'button', class: 'link-btn' }, S.remove);
      rm.setAttribute('aria-label', `${S.remove}: ${l.title}`);
      rm.addEventListener('click', () => removeLine(l.handle));
      right.append(rm);
      li.append(right);
      for (const w of l.warnings) li.append(el('p', { class: 'notice notice-warn warn', role: 'alert', style: 'margin:0' }, w));
      list.append(li);
    }
    $('[data-cart-subtotal]', root)!.textContent = data.subtotalText;
    $('[data-cart-count-text]', root)!.textContent = S.items.replace('{n}', String(data.count));
    const charge = $('[data-cart-charge]', root)!;
    charge.hidden = !data.chargeText; charge.textContent = data.chargeText || '';
    if (data.hasBlockingWarnings) setAlert(S.checkoutBlocked); else setAlert('');
    if (cfg.mode === 'shopify') checkoutBtn.disabled = data.lines.length === 0;
  }

  function setQty(handle: string, qty: number) {
    const c = readCart();
    const l = c.lines.find((x) => x.handle === handle);
    if (!l) return;
    l.quantity = Math.max(1, qty);
    writeCart(c); sync();
  }
  function removeLine(handle: string) {
    const c = readCart();
    c.lines = c.lines.filter((x) => x.handle !== handle);
    writeCart(c); sync();
  }
  // Statik demo sürümünde ödeme yoktur; buton devre dışıdır ve açıklama gösterilir.
  checkoutBtn.addEventListener('click', () => { if (!busy) setAlert(S.demoCheckout || '', 'info'); });
  sync();
}

updateBadges();
