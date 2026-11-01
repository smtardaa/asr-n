/**
 * Hukuki metin ŞABLONLARI — yalnızca bölüm başlıkları. İşletmeye özgü içerik hukuki danışmanlıkla doldurulmalıdır.
 * Her bölüm sitede "Doldurulacak" etiketiyle gösterilir; kesin koşul yazılmaz.
 */
import type { Locale } from '../config/site';

type Sections = Record<Locale, string[]>;

export const LEGAL_SECTIONS: Record<'privacy' | 'distanceSales' | 'preInfo' | 'kvkk' | 'cookies' | 'terms' | 'shipping' | 'returns', Sections> = {
  privacy: {
    tr: ['Veri sorumlusu', 'Toplanan veriler', 'Verilerin işlenme amaçları', 'Üçüncü taraflarla paylaşım (Shopify, ödeme kuruluşu, kargo)', 'Saklama süreleri', 'Haklarınız ve başvuru yolu'],
    en: ['Data controller', 'Data we collect', 'Purposes of processing', 'Sharing with third parties (Shopify, payment provider, carrier)', 'Retention periods', 'Your rights and how to apply'],
    ja: ['データ管理者', '収集するデータ', '利用目的', '第三者への提供（Shopify、決済事業者、配送業者）', '保存期間', 'お客様の権利と申請方法'],
    ru: ['Оператор данных', 'Какие данные мы собираем', 'Цели обработки', 'Передача третьим лицам (Shopify, платёжный провайдер, служба доставки)', 'Сроки хранения', 'Ваши права и порядок обращения'],
  },
  distanceSales: {
    tr: ['Taraflar (satıcı ve alıcı bilgileri)', 'Sözleşmenin konusu', 'Ürün, fiyat ve ödeme bilgileri', 'Teslimat', 'Cayma hakkı ve istisnaları', 'Uyuşmazlıkların çözümü'],
    en: ['Parties (seller and buyer details)', 'Subject of the agreement', 'Product, price and payment details', 'Delivery', 'Right of withdrawal and exceptions', 'Dispute resolution'],
    ja: ['当事者（販売者・購入者情報）', '契約の目的', '商品・価格・支払い情報', '配送', '撤回権とその例外', '紛争の解決'],
    ru: ['Стороны (данные продавца и покупателя)', 'Предмет договора', 'Товар, цена и оплата', 'Доставка', 'Право на отказ и исключения', 'Разрешение споров'],
  },
  preInfo: {
    tr: ['Satıcı bilgileri', 'Ürünün temel nitelikleri', 'Toplam fiyat ve ödeme şekli', 'Teslimat koşulları', 'Cayma hakkı bilgilendirmesi', 'Şikâyet ve itiraz yolları'],
    en: ['Seller information', 'Main characteristics of the product', 'Total price and payment method', 'Delivery terms', 'Information on the right of withdrawal', 'Complaints and objections'],
    ja: ['販売者情報', '商品の主な特徴', '合計金額と支払方法', '配送条件', '撤回権に関する情報', '苦情・異議申し立て'],
    ru: ['Сведения о продавце', 'Основные характеристики товара', 'Итоговая цена и способ оплаты', 'Условия доставки', 'Информация о праве на отказ', 'Жалобы и возражения'],
  },
  kvkk: {
    tr: ['Veri sorumlusunun kimliği', 'Kişisel verilerin işlenme amacı', 'Aktarılan taraflar ve aktarım amacı', 'Toplama yöntemi ve hukuki sebebi', 'KVKK m.11 kapsamındaki haklar'],
    en: ['Identity of the data controller', 'Purpose of processing personal data', 'Recipients and purpose of transfer', 'Collection method and legal basis', 'Rights under Article 11 of the KVKK'],
    ja: ['データ管理者の身元', '個人データの処理目的', '提供先と提供目的', '収集方法と法的根拠', 'KVKK第11条に基づく権利'],
    ru: ['Сведения об операторе данных', 'Цель обработки персональных данных', 'Получатели и цель передачи', 'Способ сбора и правовое основание', 'Права по статье 11 KVKK'],
  },
  cookies: {
    tr: ['Çerez nedir?', 'Kullanılan çerez türleri', 'Zorunlu çerezler (sepet, dil tercihi)', 'Analitik / pazarlama çerezleri', 'Çerez tercihlerinin yönetimi'],
    en: ['What is a cookie?', 'Types of cookies used', 'Strictly necessary storage (cart, language)', 'Analytics / marketing cookies', 'Managing your preferences'],
    ja: ['Cookieとは', '使用するCookieの種類', '必須の保存（カート、言語設定）', '分析・マーケティング用Cookie', '設定の管理'],
    ru: ['Что такое cookie?', 'Используемые типы cookie', 'Обязательное хранение (корзина, язык)', 'Аналитические и маркетинговые cookie', 'Управление настройками'],
  },
  terms: {
    tr: ['Kapsam', 'Site kullanım kuralları', 'Fikri mülkiyet', 'Ürün bilgileri ve görseller', 'Sorumluluğun sınırlandırılması', 'Değişiklikler'],
    en: ['Scope', 'Rules of use', 'Intellectual property', 'Product information and images', 'Limitation of liability', 'Changes'],
    ja: ['適用範囲', '利用規則', '知的財産', '商品情報と画像', '責任の制限', '変更'],
    ru: ['Область применения', 'Правила использования', 'Интеллектуальная собственность', 'Информация о товарах и изображения', 'Ограничение ответственности', 'Изменения'],
  },
  shipping: {
    tr: ['Kargo firması', 'Kargo ücreti', 'Teslimat süresi', 'Ücretsiz kargo sınırı', 'Paketleme', 'Yurt dışı gönderim'],
    en: ['Carrier', 'Shipping fee', 'Delivery time', 'Free shipping threshold', 'Packaging', 'International shipping'],
    ja: ['配送業者', '送料', 'お届け日数', '送料無料の条件', '梱包', '海外発送'],
    ru: ['Служба доставки', 'Стоимость доставки', 'Сроки доставки', 'Порог бесплатной доставки', 'Упаковка', 'Международная доставка'],
  },
  returns: {
    tr: ['İptal koşulları', 'İade koşulları', 'Cayma hakkı süresi', 'İade kargo ücreti', 'Para iadesi süreci', 'İade edilemeyen ürünler'],
    en: ['Cancellation terms', 'Return terms', 'Withdrawal period', 'Return shipping cost', 'Refund process', 'Non-returnable items'],
    ja: ['キャンセル条件', '返品条件', '撤回期間', '返送料', '返金手続き', '返品できない商品'],
    ru: ['Условия отмены', 'Условия возврата', 'Срок отказа', 'Стоимость обратной доставки', 'Порядок возврата денег', 'Товары, не подлежащие возврату'],
  },
};
