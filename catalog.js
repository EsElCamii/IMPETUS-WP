const catalogSortSelect = document.getElementById("catalog-sort");
const catalogGrid = document.querySelector(".product-grid");
const catalogCards = catalogGrid
  ? Array.from(catalogGrid.querySelectorAll(".product-card"))
  : [];
const catalogProducts =
  typeof PRODUCTS !== "undefined" ? PRODUCTS : window.PRODUCTS || [];

const catalogOriginalOrder = new Map();
catalogCards.forEach((card, index) => {
  catalogOriginalOrder.set(card, index);
});

const getCardData = (card) => {
  const id = card?.dataset?.productId;
  const product = catalogProducts.find((item) => item.id === id);
  const name =
    product?.name || card?.querySelector("h3")?.textContent?.trim() || "";
  const priceValue =
    product?.priceValue ??
    (() => {
      const priceText =
        card?.querySelector(".price")?.textContent?.trim() || "";
      const match = priceText.match(/\$\s*(\d+)/);
      return match ? Number(match[1]) : 0;
    })();

  return {
    name,
    priceValue,
  };
};

const compareStrings = (a, b) => a.localeCompare(b, "es", { sensitivity: "base" });

const sortCatalog = (mode) => {
  if (!catalogGrid || catalogCards.length === 0) {
    return;
  }

  const sorted = [...catalogCards].sort((cardA, cardB) => {
    if (mode === "destacados") {
      return catalogOriginalOrder.get(cardA) - catalogOriginalOrder.get(cardB);
    }

    const dataA = getCardData(cardA);
    const dataB = getCardData(cardB);

    if (mode === "precio-asc") {
      return dataA.priceValue - dataB.priceValue;
    }
    if (mode === "precio-desc") {
      return dataB.priceValue - dataA.priceValue;
    }
    if (mode === "nombre-desc") {
      return compareStrings(dataB.name, dataA.name);
    }
    return compareStrings(dataA.name, dataB.name);
  });

  sorted.forEach((card) => catalogGrid.appendChild(card));
};

if (catalogSortSelect) {
  catalogSortSelect.addEventListener("change", (event) => {
    sortCatalog(event.target.value);
  });
}
