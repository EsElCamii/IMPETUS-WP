const PRODUCTS = [
  {
    id: "catuai-amarillo",
    name: "Catuaí Amarillo",
    price: "Desde $320",
    priceValue: 320,
    priceId: "price_1SxGX6CtADenWoLmOjLKR53u",
    image: "images/node-21.png",
    images: [
      "images/node-21.png",
      "images/node-21.png",
      "images/node-21.png",
      "images/node-21.png",
      "images/node-21.png",
    ],
    description:
      "Café balanceado y brillante, con acidez cítrica ligera y un cuerpo suave.",
    origin: "Coatepec, Veracruz",
    notes: "Tostado medio",
    weight: "500g",
    badge: "Nuevo",
    sizes: [
      { label: "250g", grams: 250, price: 320, priceId: "price_1SxGX6CtADenWoLmOjLKR53u" },
      { label: "500g", grams: 500, price: 480, priceId: "price_catuai_500g" },
      { label: "1kg", grams: 1000, price: 860, priceId: "price_catuai_1kg" },
    ],
    features: [
      "Acidez cítrica balanceada",
      "Cuerpo sedoso",
      "Tostado medio",
      "Origen de altura",
    ],
  },
  {
    id: "zongolica",
    name: "Zongolica",
    price: "Desde $340",
    priceValue: 340,
    priceId: "price_zongolica_500g",
    image: "images/node-30.png",
    images: [
      "images/node-30.png",
      "images/node-30.png",
      "images/node-30.png",
      "images/node-30.png",
      "images/node-30.png",
    ],
    description:
      "Perfil dulce y achocolatado, con cuerpo medio y final limpio.",
    origin: "Sierra de Zongolica, Veracruz",
    notes: "Tostado medio",
    weight: "500g",
    badge: "Nuevo",
    sizes: [
      { label: "250g", grams: 250, price: 340, priceId: "price_zongolica_250g" },
      { label: "500g", grams: 500, price: 500, priceId: "price_zongolica_500g" },
      { label: "1kg", grams: 1000, price: 880, priceId: "price_zongolica_1kg" },
    ],
    features: [
      "Notas a cacao",
      "Cuerpo medio",
      "Final limpio",
      "Ideal para filtro",
    ],
  },
  {
    id: "cosautlan",
    name: "Cosautlán",
    price: "Desde $330",
    priceValue: 330,
    priceId: "price_cosautlan_500g",
    image: "images/node-38.png",
    images: [
      "images/node-38.png",
      "images/node-38.png",
      "images/node-38.png",
      "images/node-38.png",
      "images/node-38.png",
    ],
    description:
      "Café de perfil redondo, con notas a nuez y aroma profundo.",
    origin: "Cosautlán de Carvajal, Veracruz",
    notes: "Tostado medio",
    weight: "500g",
    badge: "Nuevo",
    sizes: [
      { label: "250g", grams: 250, price: 330, priceId: "price_cosautlan_250g" },
      { label: "500g", grams: 500, price: 490, priceId: "price_cosautlan_500g" },
      { label: "1kg", grams: 1000, price: 870, priceId: "price_cosautlan_1kg" },
    ],
    features: [
      "Notas a nuez",
      "Aroma intenso",
      "Cuerpo balanceado",
      "Origen montañoso",
    ],
  },
  {
    id: "corahe",
    name: "Corahe",
    price: "Desde $300",
    priceValue: 300,
    priceId: "price_corahe_500g",
    image: "images/node-46.png",
    images: [
      "images/node-46.png",
      "images/node-46.png",
      "images/node-46.png",
      "images/node-46.png",
      "images/node-46.png",
    ],
    description:
      "Perfil suave y dulce, con baja acidez y excelente para bebidas frías.",
    origin: "Huatusco, Veracruz",
    notes: "Tostado medio",
    weight: "500g",
    badge: "Nuevo",
    sizes: [
      { label: "250g", grams: 250, price: 300, priceId: "price_corahe_250g" },
      { label: "500g", grams: 500, price: 460, priceId: "price_corahe_500g" },
      { label: "1kg", grams: 1000, price: 830, priceId: "price_corahe_1kg" },
    ],
    features: [
      "Baja acidez",
      "Ideal para cold brew",
      "Notas dulces",
      "Cuerpo ligero",
    ],
  },
];

if (typeof window !== "undefined") {
  window.PRODUCTS = PRODUCTS;
}
