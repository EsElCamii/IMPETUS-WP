const CATALOG_ITEMS = [
  {
    productId: "el-guayabal",
    name: "El Guayabal",
    sizes: [
      {
        label: "250 gr.",
        grams: 250,
        priceMxn: 400,
        priceId: "price_el_guayabal_250g",
      },
    ],
  },
  {
    productId: "catuai-amarillo",
    name: "Catuaí Amarillo",
    sizes: [
      {
        label: "500 gr.",
        grams: 500,
        priceMxn: 580,
        priceId: "price_catuai_amarillo_500g",
      },
    ],
  },
  {
    productId: "corahe",
    name: "Corahe",
    sizes: [
      {
        label: "500 gr.",
        grams: 500,
        priceMxn: 520,
        priceId: "price_corahe_500g",
      },
    ],
  },
  {
    productId: "cosautlan",
    name: "Cosautlán",
    sizes: [
      {
        label: "500 gr.",
        grams: 500,
        priceMxn: 442,
        priceId: "price_cosautlan_500g",
      },
    ],
  },
  {
    productId: "zongolica",
    name: "Zongolica",
    sizes: [
      {
        label: "500 gr.",
        grams: 500,
        priceMxn: 450,
        priceId: "price_zongolica_500g",
      },
    ],
  },
];

const PRICE_ID_MAP = new Map();

for (const product of CATALOG_ITEMS) {
  for (const size of product.sizes) {
    PRICE_ID_MAP.set(size.priceId, {
      productId: product.productId,
      productName: product.name,
      grams: size.grams,
      priceMxn: size.priceMxn,
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
