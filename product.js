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
const productRoastOptions = document.getElementById("product-roast-options");
const productGrindOptions = document.getElementById("product-grind-options");
const productStory = document.getElementById("product-story");
const productFacts = document.getElementById("product-facts");
let selectedSizePrice = null;
let selectedSizePriceId = null;

const slugifyOption = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const buildOptionButton = ({ group, label, caption = "", price, grams, priceId }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quick-add-option";
  button.dataset.optionGroup = group;
  button.dataset.optionValue = slugifyOption(label);
  button.dataset.label = label;

  if (typeof price === "number" && !Number.isNaN(price)) {
    button.dataset.price = String(price);
  }
  if (typeof grams === "number" && !Number.isNaN(grams)) {
    button.dataset.grams = String(grams);
  }
  if (priceId) {
    button.dataset.priceId = priceId;
  }

  const title = document.createElement("span");
  title.className = "option-label";
  title.textContent = label;
  button.appendChild(title);

  if (caption) {
    const meta = document.createElement("span");
    meta.className = "option-caption";
    meta.textContent = caption;
    button.appendChild(meta);
  }

  return button;
};

const renderOptions = (container, buttons) => {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  container.classList.toggle("quick-add-options--single", buttons.length === 1);
  buttons.forEach((button) => container.appendChild(button));
};

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const imageParam = params.get("img");
const product = PRODUCTS.find((item) => item.id === productId) || PRODUCTS[0];
const imageSrc =
  imageParam && imageParam.startsWith("images/") ? imageParam : product.image;
const images =
  Array.isArray(product.images) && product.images.length
    ? [...product.images]
    : [product.image];

if (imageSrc && !images.includes(imageSrc)) {
  images.unshift(imageSrc);
}

const sizes =
  Array.isArray(product.sizes) && product.sizes.length
    ? product.sizes
    : [
        {
          label: product.presentation || "250 gr.",
          grams: product.weight ? Number.parseInt(product.weight, 10) || 250 : 250,
          price: product.priceValue || 0,
          priceId: product.priceId || "",
        },
      ];

const minPrice = Math.min(...sizes.map((size) => size.price));
const minSize = sizes.find((size) => size.price === minPrice) || sizes[0];

const getSelectedOption = (group) =>
  productConfig?.querySelector(
    `.quick-add-option.is-selected[data-option-group="${group}"]`
  ) || null;

const updatePriceDisplay = (sizeSelected) => {
  const activeSize = sizeSelected || minSize;
  selectedSizePrice = activeSize?.price || product.priceValue;
  selectedSizePriceId = activeSize?.priceId || product.priceId;

  if (productPriceEl) {
    productPriceEl.textContent = `$${selectedSizePrice}`;
  }

  if (productPerGram) {
    const grams = activeSize?.grams || 0;
    productPerGram.textContent =
      grams > 0 ? `$${(selectedSizePrice / grams).toFixed(2)} / g` : "";
  }
};

const renderTextBlocks = (container, value) => {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  String(value || "")
    .split("\n\n")
    .filter(Boolean)
    .forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph.trim();
      container.appendChild(p);
    });
};

const renderFacts = () => {
  if (!productFacts) {
    return;
  }

  const facts = [
    ["Puntuación de taza", `${product.cupScore} pts`],
    ["Proceso", product.process],
    ["Fermentación", product.fermentation],
    ["Secado", product.drying],
    ["Productor", product.producer],
    ["Variedad", product.variety],
    ["Localidad", product.locality],
    ["Finca", product.farm],
    ["Altitud", product.altitude],
    ["Categoría", product.category],
    ["Tuestes disponibles", (product.roastOptions || []).join(" · ")],
  ].filter(([, value]) => Boolean(value));

  productFacts.innerHTML = "";
  facts.forEach(([label, value]) => {
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    item.appendChild(dt);
    item.appendChild(dd);
    productFacts.appendChild(item);
  });
};

const renderSizeOptions = () => {
  renderOptions(
    productSizeOptions,
    sizes.map((size) =>
      buildOptionButton({
        group: "size",
        label: size.label,
        caption: `$${size.price}`,
        price: size.price,
        grams: size.grams,
        priceId: size.priceId,
      })
    )
  );
};

const renderTextOptions = (container, values, group) => {
  renderOptions(
    container,
    (Array.isArray(values) ? values : []).map((value) =>
      buildOptionButton({
        group,
        label: value,
      })
    )
  );
};

if (productName) {
  productName.textContent = product.name;
}
if (breadcrumbProduct) {
  breadcrumbProduct.textContent = product.name;
}
if (productImage) {
  productImage.src = imageSrc;
  productImage.alt = product.name;
}
if (productDescription) {
  productDescription.textContent = product.summary || product.description;
}
if (productMeta) {
  productMeta.textContent = `${product.origin} · ${product.presentation} · ${product.cupScore} pts`;
}
if (productOldPrice) {
  if (product.originalPrice) {
    productOldPrice.textContent = product.originalPrice;
    productOldPrice.style.display = "";
  } else {
    productOldPrice.style.display = "none";
  }
}
if (productBadge) {
  if (product.badge) {
    productBadge.textContent = product.badge;
    productBadge.style.display = "";
  } else {
    productBadge.style.display = "none";
  }
}

updatePriceDisplay(minSize);
renderSizeOptions();
renderTextOptions(productRoastOptions, product.roastOptions, "roast");
renderTextOptions(productGrindOptions, product.grindOptions, "grind");
renderTextBlocks(productStory, product.description);
renderFacts();

if (Array.isArray(product.tastingNotes) && product.tastingNotes.length > 0 && productFeatures) {
  productFeatures.innerHTML = "";
  product.tastingNotes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    productFeatures.appendChild(item);
  });
} else if (productFeatures) {
  productFeatures.style.display = "none";
}

if (productThumbs && productImage) {
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
  const defaultSize = productConfig.querySelector(
    '.quick-add-option[data-option-group="size"]'
  );
  if (defaultSize) {
    defaultSize.classList.add("is-selected");
  }

  const updateProductAddState = () => {
    const sizeSelected = getSelectedOption("size");
    const roastSelected = getSelectedOption("roast");
    const grindSelected = getSelectedOption("grind");

    if (productAddButton) {
      const ready = Boolean(sizeSelected && roastSelected && grindSelected);
      productAddButton.disabled = !ready;
      productAddButton.textContent = ready
        ? "Añade al carrito"
        : "Selecciona tueste y molienda";
    }

    if (sizeSelected) {
      updatePriceDisplay({
        price: Number(sizeSelected.dataset.price) || product.priceValue,
        priceId: sizeSelected.dataset.priceId || product.priceId,
        grams: Number(sizeSelected.dataset.grams) || minSize?.grams || 0,
      });
    }
  };

  productConfig.querySelectorAll(".quick-add-option").forEach((option) => {
    option.addEventListener("click", () => {
      const group = option.dataset.optionGroup;
      productConfig
        .querySelectorAll(`.quick-add-option[data-option-group="${group}"]`)
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
      productQty.textContent = String(Math.max(1, current + delta));
    });
  });

  updateProductAddState();
}

if (productAddButton) {
  productAddButton.addEventListener("click", () => {
    if (!productConfig || productAddButton.disabled) {
      return;
    }

    const sizeSelected = getSelectedOption("size");
    const roastSelected = getSelectedOption("roast");
    const grindSelected = getSelectedOption("grind");
    const qty = Number(productQty?.textContent) || 1;
    const presentation = sizeSelected?.dataset.label || product.presentation || "";

    window.Cart?.addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      priceValue: selectedSizePrice || product.priceValue,
      priceId: selectedSizePriceId || product.priceId,
      image: productImage?.src || product.image,
      size: presentation,
      presentation,
      roast: roastSelected?.dataset.label || roastSelected?.textContent.trim() || "",
      grind: grindSelected?.dataset.label || grindSelected?.textContent.trim() || "",
      qty,
    });

    window.Cart?.open();
  });
}
