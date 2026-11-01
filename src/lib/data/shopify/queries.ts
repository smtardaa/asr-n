/**
 * Storefront API GraphQL sorguları (2026-10). Tüm ürün özellikleri "asrin" namespace'li metafield'lardan okunur.
 * Metafield'ların Storefront API'ye açık olması gerekir (Admin → Ayarlar → Özel veriler → ilgili tanımda "Storefront erişimi").
 * Eşleme tablosu: docs/SHOPIFY.md
 */

export const PRODUCT_METAFIELDS = [
  'country', 'period', 'emission', 'tertip', 'ruler', 'year_from', 'year_to', 'year_text', 'denomination', 'denomination_text', 'unit',
  'condition', 'catalog_number', 'material', 'certification_authority', 'certification_grade', 'product_type', 'is_demo',
] as const;

const METAFIELD_IDENTIFIERS = PRODUCT_METAFIELDS.map((k) => `{namespace: "asrin", key: "${k}"}`).join(', ');

export const PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment AsrinProduct on Product {
    id
    handle
    title
    description
    availableForSale
    createdAt
    updatedAt
    tags
    productType
    seo { title description }
    featuredImage { url altText width height }
    images(first: 12) { nodes { url altText width height } }
    variants(first: 1) {
      nodes {
        id
        sku
        availableForSale
        quantityAvailable
        price { amount currencyCode }
      }
    }
    collections(first: 20) { nodes { handle } }
    metafields(identifiers: [${METAFIELD_IDENTIFIERS}]) { key value type }
  }
`;

export const PRODUCT_BY_HANDLE = /* GraphQL */ `
  ${PRODUCT_FRAGMENT}
  query ProductByHandle($handle: String!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    product(handle: $handle) { ...AsrinProduct }
  }
`;

/** Dizin modu: tüm yayımlanmış ürünler sayfalanarak alınır (250'şer). */
export const PRODUCTS_PAGE = /* GraphQL */ `
  ${PRODUCT_FRAGMENT}
  query ProductsPage($cursor: String, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes { ...AsrinProduct }
    }
  }
`;

export const COLLECTIONS = /* GraphQL */ `
  query Collections($cursor: String, $language: LanguageCode) @inContext(language: $language) {
    collections(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        description
        image { url altText width height }
        parent: metafield(namespace: "asrin", key: "parent") { reference { ... on Collection { handle } } }
        sortOrder: metafield(namespace: "asrin", key: "sort_order") { value }
      }
    }
  }
`;

/** Ana sayfa seçkisi: "asrin_home" tipinde, handle'ı "home" olan metaobject. */
export const HOME_METAOBJECT = /* GraphQL */ `
  query Home($language: LanguageCode) @inContext(language: $language) {
    metaobject(handle: { type: "asrin_home", handle: "home" }) {
      fields {
        key
        value
        references(first: 20) {
          nodes {
            ... on Product { handle }
            ... on Collection { handle }
          }
        }
        reference { ... on Collection { handle } ... on Product { handle } }
      }
    }
  }
`;

const CART_FRAGMENT = /* GraphQL */ `
  fragment AsrinCart on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
    }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { amountPerQuantity { amount currencyCode } totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            id
            availableForSale
            quantityAvailable
            product { handle }
          }
        }
      }
    }
  }
`;

export const CART_QUERY = /* GraphQL */ `
  ${CART_FRAGMENT}
  query Cart($id: ID!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    cart(id: $id) { ...AsrinCart }
  }
`;

export const CART_CREATE = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartCreate($input: CartInput!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    cartCreate(input: $input) { cart { ...AsrinCart } userErrors { field message } warnings { code message } }
  }
`;

export const CART_LINES_ADD = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...AsrinCart } userErrors { field message } warnings { code message } }
  }
`;

export const CART_LINES_UPDATE = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...AsrinCart } userErrors { field message } warnings { code message } }
  }
`;

export const CART_LINES_REMOVE = /* GraphQL */ `
  ${CART_FRAGMENT}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...AsrinCart } userErrors { field message } warnings { code message } }
  }
`;
