/**
 * Arama için metin normalleştirme: Türkçe büyük/küçük harf (İ/ı), diakritikler (ş→s, ğ→g, ü→u, ö→o, ç→c, â→a),
 * Kiril/Japonca karakterleri korur, noktalama ve binlik ayırıcıları sadeleştirir.
 */
const MAP: Record<string, string> = {
  ı: 'i', İ: 'i', I: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
  â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u', ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe', ё: 'е', Ё: 'е',
};

export function fold(input: string): string {
  if (!input) return '';
  let s = '';
  // NFKD bölünmez boşluğu normal boşluğa çevirdiği için binlik gruplar (1 000 000) önce birleştirilir
  for (const ch of input.replace(/(\d)[  ](?=\d{3}(\D|$))/g, '$1')) s += MAP[ch] ?? ch;
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d)[.,  ](?=\d{3}(\D|$))/g, '$1') // 1.000.000 / 1 000 000 (NBSP) → 1000000
    .replace(/[^\p{L}\p{N}#/\-\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(input: string): string[] {
  return fold(input)
    .split(/[\s/\-]+/)
    .map((t) => t.replace(/^#/, ''))
    .filter(Boolean);
}

export function slugify(input: string): string {
  return fold(input).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
