"""
Ham kaynak verisinden (scrape.py çıktısı) ASRIN demo kataloğunu üretir.

Kullanım:  python -I scripts/catalog/build_catalog.py <raw_dir> <project_dir>
Çıktı:     src/data/catalog/categories.json, products.json, catalog-report.json

İlkeler
- Kaynakta olmayan özellik uydurulmaz; ayrıştırılamayan alan boş bırakılır.
- Başlıklar/açıklamalar doğrulanmış özelliklerden 4 dilde yeniden yazılır; ayrıştırılamayan kaynak notları
  açıkça "kaynak notu" olarak korunur.
- Stok: kaynaktaki tüm ürünler "Var" görünüyordu. Satıldı davranışını göstermek için deterministik küçük bir alt küme
  DEMO olarak satıldı işaretlenir (demoSold=true) — bu bir kaynak verisi değildir.
"""
import json, re, sys, os, html, unicodedata
from collections import defaultdict, Counter

sys.path.insert(0, os.path.dirname(__file__))
from lexicon import COUNTRIES, HOME_COUNTRIES, UNITS, NOTES, MATERIALS, MANUAL_TITLES

RAW, PROJ = sys.argv[1], sys.argv[2]
OUT = os.path.join(PROJ, 'src', 'data', 'catalog')
os.makedirs(OUT, exist_ok=True)
BASE = 'https://eskiparamarket.com/'

load = lambda n: json.load(open(os.path.join(RAW, n), encoding='utf-8'))
listing = load('listing.json')['items']
details = load('details.json')
membership = load('membership.json')
menu = load('menu_links.json')

FOLD = str.maketrans({'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', '½': ' 1/2'})
def fold(s):
    s = (s or '').translate(FOLD)
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return s.lower()

def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', fold(s)).strip('-')

def tr_title(s):
    """Türkçe kurallarına uygun başlık biçimi (İ/ı)."""
    out = []
    for w in s.split():
        if re.fullmatch(r'[IVX]+\.?', w) or re.search(r'\d', w) or w in ('ABD', 'FAO', 'PMG', 'YTL', 'DC', 'T.C.'):
            out.append(w); continue
        low = w.replace('I', 'ı').replace('İ', 'i').lower()
        out.append(low[:1].replace('i', 'İ').replace('ı', 'I').upper() + low[1:] if low else low)
    return ' '.join(out)

def latin_title(s):
    return ' '.join(w[:1].upper() + w[1:].lower() if not re.search(r'\d', w) else w for w in fold(s).split())

# ───────────────────────── Kategori ağacı ─────────────────────────
L = lambda tr, en, ja, ru: {'tr': tr, 'en': en, 'ja': ja, 'ru': ru}
ROOTS = [
    ('t-c-kagit-paralar', 't-c-kagit-paralar', L('T.C. Kağıt Paraları', 'Turkish Republic Banknotes', 'トルコ共和国の紙幣', 'Банкноты Турецкой Республики')),
    ('t-c-madeni-paralar', 't-c-madeni-paralar', L('T.C. Madeni Paraları', 'Turkish Republic Coins', 'トルコ共和国の硬貨', 'Монеты Турецкой Республики')),
    ('t-c-hatira-paralar', 't-c-hatira-paralar', L('T.C. Hatıra Paraları', 'Turkish Commemorative Coins', 'トルコの記念硬貨', 'Памятные монеты Турции')),
    ('osmanli-paralari', 'osmanli-paralari', L('Osmanlı Paraları', 'Ottoman Coins & Notes', 'オスマン帝国の貨幣', 'Деньги Османской империи')),
    ('yabanci-paralar', 'yabanci-paralar', L('Yabancı Paralar', 'World Banknotes & Coins', '外国の貨幣', 'Иностранные деньги')),
    ('sertifikali-paralar', 'sertifikali-paralar', L('Sertifikalı Paralar', 'Certified & Graded', '鑑定済み貨幣', 'Сертифицированные')),
    ('pul', 'pul', L('Pul', 'Stamps', '切手', 'Марки')),
    ('koleksiyon-malzemeleri', 'koleksiyon-malzeme', L('Koleksiyon Malzemeleri', 'Collecting Supplies', 'コレクション用品', 'Аксессуары для коллекций')),
    ('madalya-ve-objeler', None, L('Madalya ve Objeler', 'Medals & Objects', 'メダル・オブジェ', 'Медали и предметы')),
    ('antika', None, L('Antika', 'Antiques', 'アンティーク', 'Антиквариат')),
]
ord_en = {1: 'st', 2: 'nd', 3: 'rd'}
def emission_titles(n):
    n = int(n)
    return L(f'{n}. Emisyon', f'{n}{ord_en.get(n if n < 4 else 0, "th")} Emission', f'第{n}次発行', f'{n}-я эмиссия')

SUB_TITLES = {
    'osmanli-kagit-paralari': L('Osmanlı Kağıt Paraları', 'Ottoman Banknotes', 'オスマン帝国の紙幣', 'Османские банкноты'),
    'osmanli-madeni-paralari': L('Osmanlı Madeni Paraları', 'Ottoman Coins', 'オスマン帝国の硬貨', 'Османские монеты'),
    'abdulaziz': L('Abdülaziz', 'Abdulaziz', 'アブデュルアズィズ', 'Абдул-Азиз'),
    'abdulmecid': L('Abdülmecid', 'Abdulmejid I', 'アブデュルメジト1世', 'Абдул-Меджид I'),
    'ii-abdulhamid': L('II. Abdülhamid', 'Abdulhamid II', 'アブデュルハミト2世', 'Абдул-Хамид II'),
    'ii-abdulhamid-kagit': L('II. Abdülhamid', 'Abdulhamid II', 'アブデュルハミト2世', 'Абдул-Хамид II'),
    'iv-murat': L('IV. Murat', 'Murad IV', 'ムラト4世', 'Мурад IV'),
    'v-mehmed-resad': L('V. Mehmed Reşad', 'Mehmed V Reşad', 'メフメト5世', 'Мехмед V'),
    'vi-mehmed-vahdeddin': L('VI. Mehmed Vahdeddin', 'Mehmed VI Vahideddin', 'メフメト6世', 'Мехмед VI'),
    'bimetal-nikel-aluminyum': L('Bimetal, Nikel, Alüminyum', 'Bimetal, Nickel & Aluminium', 'バイメタル・ニッケル・アルミ', 'Биметалл, никель, алюминий'),
    'bronz-princ-hatira-paralar': L('Bronz ve Pirinç Hatıra Paralar', 'Bronze & Brass Commemoratives', '青銅・黄銅の記念硬貨', 'Памятные монеты из бронзы и латуни'),
    'fao': L('FAO Hatıra Paraları', 'FAO Commemoratives', 'FAO記念硬貨', 'Памятные монеты FAO'),
    'gumus-hatira-paralar': L('Gümüş Hatıra Paralar', 'Silver Commemoratives', '銀製記念硬貨', 'Серебряные памятные монеты'),
    'hatira-para-setleri': L('Hatıra Para Setleri', 'Commemorative Sets', '記念硬貨セット', 'Наборы памятных монет'),
    'tedavul-hatira-paralar': L('Tedavül Hatıra Paralar', 'Circulating Commemoratives', '流通記念硬貨', 'Памятные монеты в обращении'),
    '1924-1957-donemi': L('1924–1957 Dönemi', '1924–1957 Period', '1924–1957年', 'Период 1924–1957'),
    '1958-2003-donemi': L('1958–2003 Dönemi', '1958–2003 Period', '1958–2003年', 'Период 1958–2003'),
    '2004-ve-sonrasi-donem': L('2004 ve Sonrası', '2004 and Later', '2004年以降', '2004 и позже'),
    'tedavul-para-setleri': L('Tedavül Para Setleri', 'Circulation Sets', '流通貨幣セット', 'Наборы монет в обращении'),
    'albumler': L('Albümler', 'Albums', 'アルバム', 'Альбомы'),
    'diger': L('Diğer Malzemeler', 'Other Supplies', 'その他の用品', 'Прочее'),
    'foyler': L('Föyler', 'Album Pages', 'リフィル', 'Листы'),
    'kapama-ve-kapsuller': L('Kapama ve Kapsüller', 'Holders & Capsules', 'ホルダー・カプセル', 'Холдеры и капсулы'),
    'katalog': L('Kataloglar', 'Catalogues', 'カタログ', 'Каталоги'),
}

def denom_titles(src_name):
    # "1.000.000 LİRA" / "5 YTL"
    m = re.match(r'([\d.]+)\s+(L[İI]RA|YTL)', src_name)
    num, unit = m.group(1), m.group(2)
    n = int(num.replace('.', ''))
    if unit == 'YTL':
        return L(f'{num} YTL', f'{n:,} New Lira', f'{n:,} 新リラ', f'{n:,} новых лир'.replace(',', ' '))
    return L(f'{num} Lira', f'{n:,} Lira', f'{n:,} リラ', f'{n:,} лир'.replace(',', ' '))

categories = {}  # handle → dict
src_to_handle = {}

def add_cat(handle, parent, title, src_path=None, order=0):
    assert handle not in categories, handle
    categories[handle] = {
        'handle': handle, 'parent': parent, 'title': title, 'children': [], 'order': order,
        'source': (BASE + src_path) if src_path else None,
    }
    if parent:
        categories[parent]['children'].append(handle)
    if src_path:
        src_to_handle[src_path] = handle

for i, (h, src, title) in enumerate(ROOTS):
    add_cat(h, None, title, src, i)

cat_paths = load('cat_paths.json')
for i, p in enumerate(cat_paths):
    parts = p.split('/')
    if parts[0] in ('firsat-urunu',) or len(parts) == 1:
        continue
    root_src, last = parts[0], parts[-1]
    parent = src_to_handle['/'.join(parts[:-1])]
    name = menu[p][-1]
    if root_src == 'yabanci-paralar':
        h, tr, en, ja, ru = COUNTRIES[last]
        add_cat(h, parent, L(tr, en, ja, ru), p, i)
    elif root_src == 't-c-kagit-paralar' and len(parts) == 2:
        n = re.match(r'(\d)', last).group(1)
        add_cat(f'{n}-emisyon', parent, emission_titles(n), p, i)
    elif root_src == 't-c-kagit-paralar' and len(parts) == 3:
        em = re.match(r'(\d)', parts[1]).group(1)
        d = re.match(r'([\d.]+\s+\S+)', name).group(1)
        h = f'{em}-emisyon-' + slugify(d).replace('lira', 'lira')
        add_cat(h, parent, denom_titles(name), p, i)
    else:
        key = 'ii-abdulhamid-kagit' if p.endswith('osmanli-kagit-paralari/ii-abdulhamid-1') else last
        add_cat(key, parent, SUB_TITLES[key], p, i)

# ───────────────────────── Ürün ayrıştırma ─────────────────────────
def norm_slug(u):
    return u.split('?')[0].rstrip('/').split('/')[-1]

details_by_slug = {norm_slug(u): v for u, v in details.items() if v}
listing_by_slug = {norm_slug(i['url']): i for i in listing}
members = defaultdict(set)  # slug → set(src category path)
for path, v in membership.items():
    for u in v['urls']:
        members[norm_slug(u)].add(path)

# Kaynakta açıkça yanlış kategoride duran ürünler için minimal düzeltmeler (ilerleme.md'de listelenir)
OVERRIDES = {
    'ismet-inonu-1940-gumus-1-lira-kondisyon-10-8': ['t-c-madeni-paralar/1924-1957-donemi'],
}

RX_EMISSION = re.compile(r'\b(\d)\s*[.,]?\s*EM[İI]SYON', re.I)
RX_TERTIP = re.compile(r'\b(\d)\s*[.,]?\s*TERT[İI]P|(\d)TERT[İI]P', re.I)
_NL = r'(?![A-Za-zİıŞşĞğÜüÖöÇç])'
RX_PICK = re.compile(r'(?:P[İI]K\s*P?\s*[-/]?\s*|P[#\-]\s*|\bP\s*#\s*)(\d{1,4}(?:\s?[A-Za-z]' + _NL + r')?(?:\s*[-/]\s*[A-Za-z0-9]{1,3}' + _NL + r')?)', re.I)
RX_COND = re.compile(r'KOND[İI]SYON\s*:?\s*(10\s*/\s*[,.]?\s*\d+(?:[,.]\d+)?|PMG\s*\d+|Ç[İI]L(?:\s*ALTI)?-?|ÇT-?)', re.I)
RX_PMG = re.compile(r'\b(PMG|PCGS|NGC|PCCS)\s*(\d{1,2})', re.I)
RX_YEAR_KW = re.compile(r'YIL\s*:?\s*(\d{4})(?:\s*[-/]\s*(\d{2,4}))?', re.I)
RX_YEAR = re.compile(r'(?<![\d.,/#])(1[6-9]\d{2}|20[0-2]\d)(?:\s*[-/]\s*(\d{2,4}))?(?![\d.,])')
RX_HIJRI = re.compile(r'\b(1[12]\d{2}|13[0-4]\d)\s*/\s*(\d{1,2})\b')

def parse_cond(t):
    m = RX_COND.search(t)
    if not m:
        m2 = RX_PMG.search(t)
        return (f'{m2.group(1).upper()} {m2.group(2)}' if m2 else None)
    c = re.sub(r'\s+', '', m.group(1).upper())
    if c.startswith('PMG'):
        return 'PMG ' + c[3:]
    if c.startswith('10/'):
        v = c[3:].lstrip(',.').replace('.', ',')
        return f'10/{v}'
    return {'ÇİL': 'Çil', 'ÇİL-': 'Çil-', 'ÇİLALTI': 'Çil altı', 'ÇT': 'Çok temiz', 'ÇT-': 'Çok temiz-'}.get(c, c.title())

def parse_years(t, is_ottoman):
    hij = RX_HIJRI.search(t) if is_ottoman else None
    t = re.sub(r'(\d)(P#)', r'\1 \2', t)
    def _unit_follows(x):
        mw = re.match(r'\s+([A-Za-zÇĞİÖŞÜçğıöşü]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+)?)', t[x.end():])
        if not mw:
            return False
        w = fold(mw.group(1)).split()
        return w[0] in UNITS or ' '.join(w[:2]) in UNITS
    allm = [x for x in RX_YEAR.finditer(t) if not _unit_follows(x)]
    m = RX_YEAR_KW.search(t) or (allm[-1] if allm else None)
    if m:
        y1 = int(m.group(1))
        if is_ottoman and y1 < 1400:
            m = None
    if hij and not m:
        return None, None, f'H{hij.group(1)}/{hij.group(2)}'
    if not m:
        return None, None, None
    y1 = int(m.group(1))
    y2 = m.group(2)
    if y2:
        y2i = int(y2) if len(y2) == 4 else int(str(y1)[:4 - len(y2)] + y2)
        if y2i > y1 and y2i - y1 < 60:
            return y1, y2i, f'{y1}–{y2i}'
    return y1, y1, str(y1)

UNIT_KEYS = sorted(UNITS.keys(), key=len, reverse=True)
def parse_denom(rest):
    """rest: ülke/emisyon çıkarılmış başlık. Dönüş: (sayı, sayı_metni, birim_anahtarı, birim_kaynak)"""
    found = None
    for m in re.finditer(r'(?<![\d.,])((?:\d[\d.,]*(?:\s*(?:½|1/2))?)|½|1/2)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+){0,2})', rest):
        words = fold(m.group(2)).split()
        for n in (3, 2, 1):
            k = ' '.join(words[:n])
            if len(words) >= n and k in UNITS:
                found = (m, k, ' '.join(m.group(2).split()[:n]))
                break
        if found:
            break
    if not found:
        return None
    m, k, unit_src = found
    num_txt = m.group(1).strip()
    half = '½' in num_txt or '1/2' in num_txt
    base = re.sub(r'\s*(½|1/2)', '', num_txt) or '0'
    if re.fullmatch(r'\d{1,3}(?:[.,]\d{3})+', base):
        val = float(re.sub(r'[.,]', '', base))
    else:
        val = float(base.replace(',', '.'))
    if half:
        val += 0.5
    return val, num_txt.replace('1/2', '½').replace(' ½', ' ½'), k, unit_src

def num_text(v, loc):
    if v == int(v):
        n = int(v)
        if loc == 'tr':
            return f'{n:,}'.replace(',', '.')
        if loc == 'ru':
            return f'{n:,}'.replace(',', ' ')
        return f'{n:,}'
    s = f'{v:g}'
    if v % 1 == 0.5 and v < 10:
        return f'{int(v)} ½' if v >= 1 else '½'
    return s.replace('.', ',') if loc in ('tr', 'ru') else s

def material_of(t):
    f = fold(t)
    for k, keys in (('silver', ['gumus']), ('gold', ['altin ']), ('bimetal', ['bimetal']), ('bronze', ['bronz']), ('brass', ['princ', 'pirinc']), ('nickel', ['nikel'])):
        if any(x in f for x in keys):
            return k
    return None

def notes_of(t):
    f = fold(t)
    return [k for k in NOTES if k in f]

products, report = [], Counter()
cat_products = defaultdict(set)
seen_handles = set()

for slug, d in details_by_slug.items():
    li = listing_by_slug.get(slug, {})
    paths = OVERRIDES.get(slug) or sorted(p for p in members.get(slug, ()) if not p.startswith('firsat-urunu'))
    title_src = re.sub(r'\s+', ' ', d['title']).strip()
    tf = fold(title_src)
    if not paths:
        # Yalnızca "fırsat ürünü" listesinde görünen ürünler: başlığa göre yerleştir
        if 'album' in tf:
            paths = ['koleksiyon-malzeme/albumler']
        elif 'fantazi' in tf:
            paths = ['t-c-hatira-paralar']
        elif 'ankara kecisi' in tf:
            paths = ['t-c-hatira-paralar/tedavul-hatira-paralar']
        else:
            report['uncategorized'] += 1
    handles = sorted({src_to_handle[p] for p in paths if p in src_to_handle})
    if not handles:
        report['skipped_no_category'] += 1
        continue
    # birincil kategori: en derin yol
    primary = max(handles, key=lambda h: (len(cat_chain(h)) if 'cat_chain' in globals() else 0, h))

    is_ottoman = any(p.startswith('osmanli') for p in paths)
    is_foreign = any(p.startswith('yabanci-paralar/') for p in paths)
    is_tc_note = any(p.startswith('t-c-kagit-paralar') for p in paths)
    is_supply = any(p.startswith('koleksiyon-malzeme/albumler') for p in paths) or 'album' in tf
    country_h = next((src_to_handle[p] for p in paths if p.startswith('yabanci-paralar/')), None)

    attrs = {}
    rest = title_src
    if country_h:
        # Kaynakta "Yabancı Paralar › Türkiye" alt kategorisi de var; ülke özelliği tek bir "turkiye" değeriyle tutulur
        attrs['country'] = 'turkiye' if country_h == 'turkiye-yabanci' else country_h
        tr_name = categories[country_h]['title']['tr']
        # Başlıktaki ülke adını at (kaynakta büyük harf)
        cand = [tr_name, tr_name.split(' (')[0], tr_name.split(' /')[0]]
        for c in cand:
            pat = re.compile(re.escape(c.upper().replace('I', 'I')), re.I)
            if fold(rest).startswith(fold(c)):
                rest = rest[len(c):]
                break
    elif is_ottoman:
        attrs['country'] = 'osmanli-imparatorlugu'
    elif not is_supply:
        attrs['country'] = 'turkiye'

    em = RX_EMISSION.search(title_src)
    if em and not country_h:
        attrs['emission'] = em.group(1)
    tt = RX_TERTIP.search(title_src)
    if tt:
        attrs['tertip'] = tt.group(1) or tt.group(2)
    pk = RX_PICK.search(title_src)
    if pk and not is_supply:
        cat_no = re.sub(r'\s+', '', pk.group(1)).replace('-', '/')
        attrs['catalogNumber'] = 'P-' + cat_no
    cond = parse_cond(title_src)
    if cond:
        attrs['condition'] = cond
    y1, y2, ytxt = parse_years(title_src, is_ottoman)
    if ytxt:
        attrs['yearText'] = ytxt
        if y1:
            attrs['yearFrom'], attrs['yearTo'] = y1, y2
    mat = material_of(title_src)
    if mat:
        attrs['material'] = mat
    pmg = RX_PMG.search(title_src)
    if pmg:
        attrs['certification'] = {'authority': pmg.group(1).upper(), 'grade': pmg.group(2)}
    elif 'sertifika' in tf and 'darphane' in tf:
        attrs['certification'] = {'authority': 'Darphane'}
    if is_ottoman:
        for h in handles:
            if h in SUB_TITLES and categories[h]['parent'] in ('osmanli-madeni-paralari', 'osmanli-kagit-paralari'):
                attrs['ruler'] = h
        if 'ruler' not in attrs and ('resat' in tf or 'resad' in tf):
            attrs['ruler'] = 'v-mehmed-resad'
        if 'ruler' not in attrs and 'abdulhamit' in tf:
            attrs['ruler'] = 'ii-abdulhamid'

    # nominal + birim: emisyon/tertip ifadelerini çıkarıp ara
    rest2 = RX_EMISSION.sub(' ', rest)
    rest2 = RX_TERTIP.sub(' ', rest2)
    rest2 = re.sub(r'(\d)(P#)', r'\1 \2', rest2)
    dn = parse_denom(rest2)
    if not dn and is_tc_note and attrs.get('emission'):
        mm = re.search(r'EM[İI]SYON\s+([\d.]+)\s', title_src)
        if mm:  # TC kağıt para başlığında birim yazılmamışsa (ör. "7 EMİSYON 20.000.000 PİK") birim Lira'dır
            dn = (float(mm.group(1).replace('.', '')), mm.group(1), 'lira', 'Lira')
    if dn and not is_supply:
        attrs['denomination'], attrs['denominationText'], unit_key, unit_src = dn
        attrs['unit'] = unit_key
    if is_supply:
        attrs['productType'] = 'accessory'
    elif re.search(r'\bSET', title_src, re.I) and ('set' in tf.split() or 'seti' in tf or "'li set" in tf or 'li set' in tf):
        attrs['productType'] = 'set'
    elif is_tc_note or any(p.startswith('osmanli-paralari/osmanli-kagit') for p in paths) or (is_foreign and 'catalogNumber' in attrs):
        attrs['productType'] = 'banknote'
    elif any(p.startswith(('t-c-madeni', 't-c-hatira', 'osmanli-paralari/osmanli-madeni')) for p in paths) or mat:
        attrs['productType'] = 'coin'
    elif is_foreign:
        attrs['productType'] = 'banknote'
    if attrs.get('productType') == 'banknote' and 'material' not in attrs:
        pass  # kâğıt bilgisi kaynakta yazmıyor; eklenmez

    report['parsed_denomination'] += 'denomination' in attrs
    report['parsed_year'] += 'yearText' in attrs
    report['parsed_condition'] += 'condition' in attrs
    report['parsed_catalog'] += 'catalogNumber' in attrs

    handle = slugify(slug)
    base_h, k = handle, 2
    while handle in seen_handles:
        handle = f'{base_h}-{k}'; k += 1
    seen_handles.add(handle)

    pid = li.get('pid') or ''
    labels = [fold(x) for x in li.get('labels', [])]
    imgs = d['images'] or []
    products.append({
        'id': f'asrin-demo-{pid}' if pid else f'asrin-demo-{handle}',
        'handle': handle,
        'sku': d.get('model') or li.get('code') or None,
        'sourceTitle': title_src,
        'categories': handles,
        'attributes': attrs,
        'notes': notes_of(title_src),
        'price': {'amount': d['price'], 'currencyCode': 'TRY'},
        'sourceStock': d.get('stock_text'),
        'sourceOrder': int(pid) if pid else 0,
        'isNew': 'yeni' in labels,
        'sourceImageUrls': imgs,
        'sourceUrl': BASE + slug,
    })

def cat_chain(h):
    out = []
    while h:
        out.insert(0, h)
        h = categories[h]['parent']
    return out

# birincil kategori ve kategori sayıları
for p in products:
    p['primaryCategory'] = max(p['categories'], key=lambda h: (len(cat_chain(h)), h))
    p['categoryPath'] = cat_chain(p['primaryCategory'])
    for h in p['categories']:
        for a in cat_chain(h):
            cat_products[a].add(p['handle'])

# DEMO satıldı alt kümesi (deterministik, ~%4)
sold = 0
for p in products:
    p['demoSold'] = (p['sourceOrder'] % 23 == 0) and p['sourceOrder'] > 0
    sold += p['demoSold']

# Çok dilli başlık ve açıklama
def country_name(code, loc):
    if not code:
        return ''
    if code in HOME_COUNTRIES:
        return HOME_COUNTRIES[code][['tr', 'en', 'ja', 'ru'].index(loc)]
    return categories[code]['title'][loc]

TR_UNITS = {'lira': 'Lira', 'kurus': 'Kuruş', 'para': 'Para', 'ytl': 'YTL', 'yeni turk lirasi': 'Yeni Türk Lirası'}
def unit_name(key, loc, src_text=None):
    if loc == 'tr':
        return TR_UNITS.get(key) or UNITS[key][0]
    return UNITS[key][['en', 'ja', 'ru'].index(loc)]

TYPE_WORD = {
    'banknote': L('banknot', 'banknote', '紙幣', 'банкнота'),
    'coin': L('madeni para', 'coin', '硬貨', 'монета'),
    'set': L('set', 'set', 'セット', 'набор'),
    'accessory': L('koleksiyon malzemesi', 'collecting supply', 'コレクション用品', 'аксессуар'),
}

def gen_title(p, loc):
    a = p['attributes']
    if 'denomination' not in a or a.get('productType') in ('accessory', 'set') or not a.get('country'):
        return None
    den = num_text(a['denomination'], loc)
    unit_src = None
    if loc == 'tr':
        m = re.search(re.escape(a['denominationText']) + r'\s+(\S+(?:\s+\S+){0,2})', p['sourceTitle'])
        if m:
            words = m.group(1).split()
            n = len(UNITS_KEYLEN.get(a['unit'], 1))
            unit_src = ' '.join(words[:n])
    unit = unit_name(a['unit'], loc, unit_src)
    yr = a.get('yearText', '')
    hijri = yr.startswith('H')
    if hijri:
        yr = {'tr': f'H. {yr[1:]}', 'en': f'AH {yr[1:]}', 'ja': f'ヒジュラ暦{yr[1:]}', 'ru': f'{yr[1:]} г. х.'}[loc]
    ctry = country_name(a['country'], loc)
    if a.get('ruler'):
        ctry = categories[a['ruler']]['title'][loc]
    em = a.get('emission') if a.get('country') == 'turkiye' else None
    if loc == 'tr':
        if em:
            t = f'{em}. Emisyon {den} {unit}'
            if a.get('tertip'):
                t += f', {a["tertip"]}. Tertip'
        else:
            t = f'{ctry} {den} {unit}'
        return f'{t} ({yr})' if yr else t
    if loc == 'en':
        t = f'{ctry} {den} {unit}'
        if em:
            t += f', {em}{ord_en.get(int(em), "th")} Emission'
            if a.get('tertip'):
                t += f' (Series {a["tertip"]})'
        return f'{t} ({yr})' if yr else t
    if loc == 'ja':
        t = f'{ctry} {den}{unit}'
        if em:
            t += f' 第{em}次発行'
            if a.get('tertip'):
                t += f'・第{a["tertip"]}版'
        return f'{t}（{yr}年）' if yr and yr[0].isdigit() and '–' not in yr else (f'{t}（{yr}）' if yr else t)
    if loc == 'ru':
        t = f'{ctry}, {den} {unit}'
        if em:
            t += f', {em}-я эмиссия'
            if a.get('tertip'):
                t += f' (серия {a["tertip"]})'
        return f'{t} ({yr} г.)' if yr and yr[0].isdigit() and '–' not in yr and not hijri else (f'{t} ({yr})' if yr else t)

UNITS_KEYLEN = {k: k.split() for k in UNITS}

GLOSS = [  # kaynak başlığı yedek çevirisi için (fold edilmiş Türkçe → en, ja, ru)
    ('kondisyon', ('condition', '状態', 'состояние')), ('gumus', ('silver', '銀', 'серебро')), ('darphane', ('State Mint', '造幣局', 'Монетный двор')),
    ('hatira parasi', ('commemorative coin', '記念硬貨', 'памятная монета')), ('hatira', ('commemorative', '記念', 'памятная')),
    ('sertifikali', ('certified', '証明書付き', 'с сертификатом')), ('sertifikalidir', ('certified', '証明書付き', 'с сертификатом')),
    ('seti', ('set', 'セット', 'набор')), ('set', ('set', 'セット', 'набор')), ('para albumu', ('coin album', 'コインアルバム', 'альбом для монет')),
    ('albumu', ('album', 'アルバム', 'альбом')), ('marka', ('brand', 'ブランド', 'марка')), ('gozlu', ('slots', '枠', 'ячеек')),
    ('sayfa', ('pages', 'ページ', 'страниц')), ('madeni', ('coin', '硬貨', 'монетный')), ('metal', ('metal', '金属', 'металлический')),
    ('kisi', ('', '', '')), ('yili', ('year', '年', 'год')), ('kultur', ('culture', '文化', 'культуры')),
]

def fallback_title(p, loc):
    t = re.sub(r'\s+', ' ', p['sourceTitle']).strip(' ,')
    if loc == 'tr':
        return tr_title(t)
    return None  # aşağıda ele alınır

def gen_desc(p, loc):
    a = p['attributes']
    typ = a.get('productType')
    tw = TYPE_WORD.get(typ, {}).get(loc) if typ else None
    ctry = country_name(a.get('country'), loc)
    parts = []
    yr = a.get('yearText')
    if yr and yr.startswith('H'):
        yr = {'tr': f'Hicrî {yr[1:]}', 'en': f'AH {yr[1:]}', 'ja': f'ヒジュラ暦{yr[1:]}', 'ru': f'{yr[1:]} г. х.'}[loc]
    cond = a.get('condition')
    cat = a.get('catalogNumber')
    mat = MATERIALS[a['material']][['tr', 'en', 'ja', 'ru'].index(loc)] if a.get('material') else None
    notes = [NOTES[n][['tr', 'en', 'ja', 'ru'].index(loc)] for n in p['notes']]
    if loc == 'tr':
        if tw and ctry:
            parts.append(f'{ctry} kaynaklı {yr + " tarihli " if yr else ""}{tw}.')
        if a.get('emission') and a.get('country') == 'turkiye':
            parts.append(f'Türkiye Cumhuriyeti {a["emission"]}. emisyon serisine aittir' + (f', {a["tertip"]}. tertip.' if a.get('tertip') else '.'))
        if cat:
            parts.append(f'Pick katalog numarası {cat}.')
        if mat:
            parts.append(f'Malzeme: {mat.lower()}.')
        if cond:
            parts.append(f'Kaynak kayıtta kondisyonu {cond} olarak belirtilmiştir.')
        if a.get('certification'):
            c = a['certification']
            parts.append(f'Sertifika: {c["authority"]}{" " + c["grade"] if c.get("grade") else ""}.')
        if notes:
            parts.append('Ek bilgi: ' + ', '.join(notes) + '.')
        parts.append(f'Kaynak kaydındaki ilan başlığı: “{tr_title(p["sourceTitle"])}”.')
    elif loc == 'en':
        if tw and ctry:
            parts.append(f'{tw.capitalize()} from {ctry}{", dated " + yr if yr else ""}.')
        if a.get('emission') and a.get('country') == 'turkiye':
            parts.append(f'Part of the Turkish Republic {a["emission"]}{ord_en.get(int(a["emission"]), "th")} emission' + (f', series (tertip) {a["tertip"]}.' if a.get('tertip') else '.'))
        if cat:
            parts.append(f'Pick catalogue number {cat}.')
        if mat:
            parts.append(f'Material: {mat.lower()}.')
        if cond:
            parts.append(f'Condition stated in the source listing: {cond} (Turkish 10-point scale).' if cond.startswith('10/') else f'Condition stated in the source listing: {cond}.')
        if a.get('certification'):
            c = a['certification']
            parts.append(f'Certification: {c["authority"]}{" " + c["grade"] if c.get("grade") else ""}.')
        if notes:
            parts.append('Notes: ' + ', '.join(notes) + '.')
        parts.append(f'Original listing title (Turkish): “{tr_title(p["sourceTitle"])}”.')
    elif loc == 'ja':
        if tw and ctry:
            parts.append(f'{ctry}の{tw}' + (f'（{yr}）' if yr else '') + '。')
        if a.get('emission') and a.get('country') == 'turkiye':
            parts.append(f'トルコ共和国 第{a["emission"]}次発行シリーズ' + (f'・第{a["tertip"]}版' if a.get('tertip') else '') + '。')
        if cat:
            parts.append(f'Pickカタログ番号：{cat}。')
        if mat:
            parts.append(f'素材：{mat}。')
        if cond:
            parts.append(f'出典の記載による状態：{cond}' + ('（トルコの10段階評価）' if cond.startswith('10/') else '') + '。')
        if a.get('certification'):
            c = a['certification']
            parts.append(f'鑑定・証明：{c["authority"]}{" " + c["grade"] if c.get("grade") else ""}。')
        if notes:
            parts.append('備考：' + '、'.join(notes) + '。')
        parts.append(f'元の掲載タイトル（トルコ語）：「{tr_title(p["sourceTitle"])}」。')
    elif loc == 'ru':
        if tw and ctry:
            parts.append(f'{tw.capitalize()}: {ctry}' + (f', {yr}' if yr else '') + '.')
        if a.get('emission') and a.get('country') == 'turkiye':
            parts.append(f'Турецкая Республика, {a["emission"]}-я эмиссия' + (f', серия (тертип) {a["tertip"]}.' if a.get('tertip') else '.'))
        if cat:
            parts.append(f'Номер по каталогу Pick: {cat}.')
        if mat:
            parts.append(f'Материал: {mat.lower()}.')
        if cond:
            parts.append(f'Состояние по данным источника: {cond}' + (' (турецкая 10-балльная шкала).' if cond.startswith('10/') else '.'))
        if a.get('certification'):
            c = a['certification']
            parts.append(f'Сертификация: {c["authority"]}{" " + c["grade"] if c.get("grade") else ""}.')
        if notes:
            parts.append('Примечания: ' + ', '.join(notes) + '.')
        parts.append(f'Исходное название объявления (на турецком): «{tr_title(p["sourceTitle"])}».')
    # Kısaltmayla biten tarih (ör. "г. х.") ardından cümle sonu noktası gelmesin
    return re.sub(r'(?<!\.)\.\.(?!\.)', '.', ' '.join(parts))

generated = 0
for p in products:
    p['title'], p['description'] = {}, {}
    gt = {loc: gen_title(p, loc) for loc in ('tr', 'en', 'ja', 'ru')}
    mt = MANUAL_TITLES.get(p['handle'])
    if mt:
        p['title'] = dict(zip(('tr', 'en', 'ja', 'ru'), mt))
        p['titleSource'] = 'manual'
        generated += 1
    elif gt['tr']:
        generated += 1
        p['title'] = gt
        p['titleSource'] = 'generated'
    else:
        tr = tr_title(re.sub(r'\s+', ' ', p['sourceTitle']).strip(' ,'))
        p['title'] = {'tr': tr}
        for i, loc in enumerate(('en', 'ja', 'ru')):
            # Yedek: kaynak başlık + kısa sözlük. Bu ürünler ilerleme.md'de "çeviri gözden geçirilmeli" olarak listelenir.
            t = fold(p['sourceTitle'])
            for k, v in GLOSS:
                t = re.sub(rf'\b{k}\b', v[i], t)
            for k, v in UNITS.items():
                t = re.sub(rf'\b{k}\b', v[i] if loc != 'en' else v[0], t)
            if p['attributes'].get('country') in HOME_COUNTRIES and loc != 'en':
                pass
            t = re.sub(r'\s+', ' ', t).strip()
            p['title'][loc] = (t[:1].upper() + t[1:]) if loc == 'en' else t.upper() if False else t
        p['titleSource'] = 'source-glossary'
    for loc in ('tr', 'en', 'ja', 'ru'):
        p['description'][loc] = gen_desc(p, loc)

report['products'] = len(products)
report['titles_generated'] = generated
report['demo_sold'] = sold
report['categories'] = len(categories)
report['categories_with_products'] = sum(1 for h in categories if cat_products.get(h))

cats_out = []
for h, c in categories.items():
    c2 = dict(c)
    c2['path'] = cat_chain(h)
    c2['productCount'] = len(cat_products.get(h, ()))
    cats_out.append(c2)

for p in products:
    p.pop('notes_raw', None)

products.sort(key=lambda p: -p['sourceOrder'])
json.dump(cats_out, open(os.path.join(OUT, 'categories.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(products, open(os.path.join(OUT, 'products.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({'generatedFrom': BASE, 'listingReportedTotal': load('listing.json')['total'], **report,
           'emptyCategories': [h for h in categories if not cat_products.get(h)]},
          open(os.path.join(OUT, 'catalog-report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(dict(report))

# Nominal değer facet etiketleri için birim adları (4 dil)
used_units = sorted({p['attributes']['unit'] for p in products if p['attributes'].get('unit')})
units_out = {k: {'tr': unit_name(k, 'tr'), 'en': UNITS[k][0], 'ja': UNITS[k][1], 'ru': UNITS[k][2]} for k in used_units}
json.dump(units_out, open(os.path.join(OUT, 'units.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
