const CATALOG_ITEMS = [
  { productId: 'catuai-amarillo', name: 'Catuaí Amarillo', sizes: [
    { label: '250g', grams: 250, priceId: 'price_1SxGX6CtADenWoLmOjLKR53u' },
    { label: '500g', grams: 500, priceId: 'price_catuai_500g' },
    { label: '1kg', grams: 1000, priceId: 'price_catuai_1kg' },
  ] },
  { productId: 'zongolica', name: 'Zongolica', sizes: [
    { label: '250g', grams: 250, priceId: 'price_zongolica_250g' },
    { label: '500g', grams: 500, priceId: 'price_zongolica_500g' },
    { label: '1kg', grams: 1000, priceId: 'price_zongolica_1kg' },
  ] },
  { productId: 'cosautlan', name: 'Cosautlán', sizes: [
    { label: '250g', grams: 250, priceId: 'price_cosautlan_250g' },
    { label: '500g', grams: 500, priceId: 'price_cosautlan_500g' },
    { label: '1kg', grams: 1000, priceId: 'price_cosautlan_1kg' },
  ] },
  { productId: 'corahe', name: 'Corahe', sizes: [
    { label: '250g', grams: 250, priceId: 'price_corahe_250g' },
    { label: '500g', grams: 500, priceId: 'price_corahe_500g' },
    { label: '1kg', grams: 1000, priceId: 'price_corahe_1kg' },
  ] },
];

const PRICE_ID_MAP = new Map();

for (const product of CATALOG_ITEMS) {
  for (const size of product.sizes) {
    PRICE_ID_MAP.set(size.priceId, {
      productId: product.productId,
      productName: product.name,
      grams: size.grams,
      size: size.label,
      priceId: size.priceId,
    });
  }
}

const ALLOWED_PRICE_IDS = new Set(Array.from(PRICE_ID_MAP.keys()));

function getCatalogEntryByPriceId(priceId) {
  return PRICE_ID_MAP.get(priceId) || null;
}

function calculateOrderWeightGrams(items) {
  return items.reduce((total, item) => {
    const catalogItem = getCatalogEntryByPriceId(item.priceId);
    if (!catalogItem) {
      throw new Error(`Price not allowed: ${item.priceId}`);
    }
    return total + catalogItem.grams * item.quantity;
  }, 0);
}

module.exports = {
  ALLOWED_PRICE_IDS,
  getCatalogEntryByPriceId,
  calculateOrderWeightGrams,
};
