const productName = document.getElementById("product-name");
const productPrice = document.getElementById("product-price");
const productOldPrice = document.getElementById("product-old-price");
const productBadge = document.getElementById("product-badge");
const productImage = document.getElementById("product-image");
const productDescription = document.getElementById("product-description");
const productMeta = document.getElementById("product-meta");
const productFeatures = document.getElementById("product-features");
const breadcrumbProduct = document.getElementById("breadcrumb-product");
const productThumbs = document.getElementById("product-thumbs");
const productConfig = document.querySelector(".product-config");
const productQty = document.getElementById("product-qty");
const productAddButton = document.getElementById("product-add");
const productPriceEl = document.getElementById("product-price");
const productPerGram = document.getElementById("product-per-gram");
const productSizeOptions = document.getElementById("product-size-options");
let selectedSizePrice = null;
let selectedSizePriceId = null;

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const imageParam = params.get("img");

const product = PRODUCTS.find((item) => item.id === productId) || PRODUCTS[0];
const imageSrc = imageParam && imageParam.startsWith("images/") ? imageParam : product.image;
const images = Array.isArray(product.images) && product.images.length ? [...product.images] : [product.image];

if (imageSrc && !images.includes(imageSrc)) {
  images.unshift(imageSrc);
}


productName.textContent = product.name;
const sizes = Array.isArray(product.sizes) && product.sizes.length
  ? product.sizes
  : [
      { label: "250g", grams: 250, price: product.priceValue || 0 },
      { label: "500g", grams: 500, price: product.priceValue || 0 },
      { label: "1kg", grams: 1000, price: product.priceValue || 0 },
    ];
const minPrice = Math.min(...sizes.map((size) => size.price));
const minSize = sizes.reduce(
  (current, size) => (size.price === minPrice ? size : current),
  sizes[0]
);

if (productPriceEl) {
  productPriceEl.textContent = `$${minPrice}`;
}
if (productPerGram && minPrice > 0) {
  const grams = minSize?.grams || 0;
  if (grams > 0) {
    productPerGram.textContent = `$${(minPrice / grams).toFixed(2)} / g`;
  }
}
breadcrumbProduct.textContent = product.name;
productImage.src = imageSrc;
productImage.alt = product.name;
productDescription.textContent = product.description;
productMeta.textContent = `${product.origin} · ${product.notes} · ${product.weight}`;

const renderSizeOptions = () => {
  if (!productSizeOptions) {
    return;
  }
  productSizeOptions.innerHTML = "";
  sizes.forEach((size) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-add-option";
    button.dataset.optionGroup = "size";
    button.dataset.optionValue = size.label;
    button.dataset.price = String(size.price);
    button.dataset.grams = String(size.grams);
    if (size.priceId) {
      button.dataset.priceId = size.priceId;
    }

    const delta = size.price - minPrice;
    const deltaText =
      delta > 0
        ? `<span class="delta-plus">+</span>$${delta}`
        : `$${size.price}`;

    button.innerHTML = `
      <span class="option-label">${size.label}</span>
      <span class="option-delta">${deltaText}</span>
    `;

    productSizeOptions.appendChild(button);
  });
};

renderSizeOptions();

const setDefaultSelections = () => {
  if (!productConfig) {
    return;
  }

  const defaultSize =
    productConfig.querySelector('.quick-add-option[data-option-group="size"][data-option-value="500g"]') ||
    productConfig.querySelector('.quick-add-option[data-option-group="size"]');
  if (defaultSize) {
    defaultSize.classList.add("is-selected");
  }

  const defaultGrind =
    productConfig.querySelector('.quick-add-option[data-option-group="grind"][data-option-value="whole"]') ||
    productConfig.querySelector('.quick-add-option[data-option-group="grind"]');
  if (defaultGrind) {
    defaultGrind.classList.add("is-selected");
  }
};

setDefaultSelections();

if (product.originalPrice) {
  productOldPrice.textContent = product.originalPrice;
} else {
  productOldPrice.style.display = "none";
}

if (product.badge) {
  productBadge.textContent = product.badge;
} else {
  productBadge.style.display = "none";
}

if (Array.isArray(product.features) && product.features.length > 0) {
  productFeatures.innerHTML = "";
  product.features.forEach((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    productFeatures.appendChild(item);
  });
} else {
  productFeatures.style.display = "none";
}

if (productThumbs) {
  productThumbs.innerHTML = "";
  images.forEach((src, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-thumb";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `Ver imagen ${index + 1}`);

    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    button.appendChild(img);

    if (src === productImage.src) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      productImage.src = src;
      productThumbs.querySelectorAll(".product-thumb").forEach((el) => {
        el.classList.toggle("is-active", el === button);
      });
    });

    productThumbs.appendChild(button);
  });
}

if (productConfig) {
  const updateProductAddState = () => {
    const sizeSelected = productConfig.querySelector(
      '.quick-add-option.is-selected[data-option-group="size"]'
    );
    const grindSelected = productConfig.querySelector(
      '.quick-add-option.is-selected[data-option-group="grind"]'
    );
    if (productAddButton) {
      productAddButton.disabled = !(sizeSelected && grindSelected);
    }
    if (sizeSelected) {
      const priceValue = Number(sizeSelected.dataset.price);
      selectedSizePrice = Number.isNaN(priceValue) ? null : priceValue;
      selectedSizePriceId = sizeSelected.dataset.priceId || null;
      if (productPriceEl && selectedSizePrice) {
        productPriceEl.textContent = `$${selectedSizePrice}`;
      }
      if (productPerGram && selectedSizePrice) {
        const grams = Number(sizeSelected.dataset.grams) || 0;
        if (grams > 0) {
          productPerGram.textContent = `$${(selectedSizePrice / grams).toFixed(2)} / g`;
        }
      }
    }
  };

  productConfig.querySelectorAll(".quick-add-option").forEach((option) => {
    option.addEventListener("click", () => {
      const group = option.dataset.optionGroup;
      productConfig
        .querySelectorAll(`.quick-add-option[data-option-group=\"${group}\"]`)
        .forEach((item) => item.classList.remove("is-selected"));
      option.classList.add("is-selected");
      updateProductAddState();
    });
  });

  productConfig.querySelectorAll("[data-qty-change]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!productQty) {
        return;
      }
      const delta = Number(button.dataset.qtyChange) || 0;
      const current = Number(productQty.textContent) || 1;
      const next = Math.max(1, current + delta);
      productQty.textContent = String(next);
    });
  });

  updateProductAddState();
}

if (productAddButton) {
  productAddButton.addEventListener("click", () => {
    if (!productConfig || productAddButton.disabled) {
      return;
    }
    const sizeSelected = productConfig.querySelector(
      '.quick-add-option.is-selected[data-option-group="size"]'
    );
    const grindSelected = productConfig.querySelector(
      '.quick-add-option.is-selected[data-option-group="grind"]'
    );
    const qty = Number(productQty?.textContent) || 1;

    window.Cart?.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      priceValue: selectedSizePrice || product.priceValue,
      priceId: selectedSizePriceId || product.priceId,
      image: productImage.src,
      size: sizeSelected?.dataset.optionValue || "",
      grind: grindSelected?.textContent.trim() || "",
      qty,
    });

    window.Cart?.open();
  });
}
