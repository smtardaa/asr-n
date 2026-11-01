"""Scrape eskiparamarket.com catalog structure for ASRIN demo inventory.
Outputs raw JSON into OUT dir: categories.json, listing.json, membership.json, details.json
"""
import re, json, os, sys, time, html, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

OUT = sys.argv[1]
BASE = 'https://eskiparamarket.com'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ASRIN-demo-catalog-research'
os.makedirs(os.path.join(OUT, 'cache'), exist_ok=True)

def fetch(url, tries=3):
    key = re.sub(r'[^A-Za-z0-9]+', '_', url)[-180:]
    path = os.path.join(OUT, 'cache', key + '.html')
    if len(os.path.abspath(path)) > 240:
        import hashlib
        path = os.path.join(OUT, 'cache', hashlib.md5(url.encode()).hexdigest() + '.html')
    if os.path.exists(path):
        return open(path, encoding='utf-8').read()
    # percent-encode non-ascii path chars
    parts = urllib.parse.urlsplit(url)
    url2 = urllib.parse.urlunsplit((parts.scheme, parts.netloc, urllib.parse.quote(parts.path), parts.query, ''))
    for i in range(tries):
        try:
            req = urllib.request.Request(url2, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode('utf-8', 'replace')
            open(path, 'w', encoding='utf-8').write(body)
            time.sleep(0.15)
            return body
        except Exception as e:
            err = e
            time.sleep(1.5 * (i + 1))
    print('FAIL', url, err, file=sys.stderr)
    return ''

def clean(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', s).strip()

CARD = re.compile(r'<div class="product-layout.*?(?=<div class="product-layout|<div class="row pagination-results|$)', re.S)

def parse_listing(h):
    items = []
    for m in CARD.finditer(h):
        c = m.group(0)
        u = re.search(r'<div class="name"><a href="([^"]+)"', c)
        if not u:
            continue
        name = re.search(r'<div class="name"><a [^>]*>(.*?)</a>', c, re.S)
        price = re.search(r'class="price-normal">([^<]*)<', c) or re.search(r'class="price-new">([^<]*)<', c)
        code = re.search(r'Ürün Kodu:</span>\s*<span>([^<]*)<', c)
        labels = [clean(x) for x in re.findall(r'<span class="product-label[^"]*">(.*?)</span>', c, re.S)]
        pid = re.search(r'name="product_id" value="(\d+)"', c)
        items.append({
            'url': html.unescape(u.group(1)), 'name': clean(name.group(1)) if name else '',
            'price_text': clean(price.group(1)) if price else '', 'code': clean(code.group(1)) if code else '',
            'labels': labels, 'pid': pid.group(1) if pid else None,
        })
    total = re.search(r'toplam: (\d+) \((\d+) Sayfa\)', h)
    return items, (int(total.group(1)), int(total.group(2))) if total else (len(items), 1)

def crawl_listing(url):
    sep = '&' if '?' in url else '?'
    h = fetch(f'{url}{sep}limit=100')
    items, (total, pages) = parse_listing(h)
    for p in range(2, pages + 1):
        it, _ = parse_listing(fetch(f'{url}{sep}limit=100&page={p}'))
        items += it
    return items, total

def categories():
    h = fetch(BASE + '/')
    cats = {}
    for m in re.finditer(r'<a href="(https://eskiparamarket\.com/([a-z0-9\-/]+))"[^>]*>(.*?)</a>', h, re.S):
        url, path, txt = m.group(1), m.group(2), clean(m.group(3))
        if not txt:
            continue
        cats.setdefault(path, set()).add(txt)
    return cats

if __name__ == '__main__':
    stage = sys.argv[2] if len(sys.argv) > 2 else 'all'
    if stage in ('all', 'listing'):
        items, total = crawl_listing(BASE + '/index.php?route=product/catalog')
        print('catalog listing', len(items), 'reported', total)
        json.dump({'total': total, 'items': items}, open(os.path.join(OUT, 'listing.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if stage in ('all', 'cats'):
        cats = categories()
        json.dump({k: sorted(v) for k, v in cats.items()}, open(os.path.join(OUT, 'menu_links.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if stage in ('all', 'membership'):
        cats = json.load(open(os.path.join(OUT, 'cat_paths.json'), encoding='utf-8'))
        def one(path):
            items, total = crawl_listing(f'{BASE}/{path}')
            return path, {'total': total, 'urls': [i['url'] for i in items]}
        with ThreadPoolExecutor(4) as ex:
            res = dict(ex.map(one, cats))
        json.dump(res, open(os.path.join(OUT, 'membership.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('categories crawled', len(res))
    if stage in ('all', 'details'):
        lst = json.load(open(os.path.join(OUT, 'listing.json'), encoding='utf-8'))['items']
        def det(it):
            h = fetch(it['url'])
            if not h:
                return it['url'].split('?')[0], None
            body = re.sub(r'<style.*?</style>', '', h, flags=re.S)
            title = re.search(r'<div class="title page-title">(.*?)</div>', body, re.S)
            price = re.search(r"class='autocalc-product-price'>([^<]*)<", body)
            pval = re.search(r"data-value='([\d.]+)' class='autocalc-product-price'", body)
            stock = re.search(r'<li class="product-stock ([^"]*)"><b>Stok:</b>\s*<span>([^<]*)</span>', body)
            model = re.search(r'<li class="product-model"><b>Ürün Kodu:</b>\s*<span>([^<]*)</span>', body)
            imgs = re.search(r"lightgallery-product-images\" data-images='([^']*)'", body)
            images = []
            if imgs:
                try:
                    images = [x['src'] for x in json.loads(html.unescape(imgs.group(1)))]
                except Exception:
                    pass
            desc = re.search(r'<div class="block-content block-description">(.*?)</div>', body, re.S)
            attrs = []
            for tb in re.findall(r'<table class="table table-bordered">(.*?)</table>', body, re.S):
                for tr in re.findall(r'<tr>(.*?)</tr>', tb, re.S):
                    tds = [clean(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
                    if len(tds) == 2:
                        attrs.append(tds)
            meta_desc = re.search(r'<meta name="description" content="([^"]*)"', h)
            return it['url'].split('?')[0], {
                'title': clean(title.group(1)) if title else it['name'],
                'price_text': clean(price.group(1)) if price else '', 'price': float(pval.group(1)) if pval else None,
                'stock_class': stock.group(1) if stock else '', 'stock_text': clean(stock.group(2)) if stock else '',
                'model': clean(model.group(1)) if model else '', 'images': images,
                'description': clean(desc.group(1)) if desc else '', 'attributes': attrs,
                'meta_description': html.unescape(meta_desc.group(1)) if meta_desc else '',
            }
        with ThreadPoolExecutor(5) as ex:
            res = dict(ex.map(det, lst))
        json.dump(res, open(os.path.join(OUT, 'details.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('details', sum(1 for v in res.values() if v), 'of', len(res))
