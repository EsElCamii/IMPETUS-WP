const productName = document.getElementById("product-name");
const productPrice = document.getElementById("product-price");
const productOldPrice = document.getElementById("product-old-price");
const productBadge = document.getElementById("product-badge");
const productImage = document.getElementById("product-image");
const productDescription = document.getElementById("product-description");
const productMeta = document.getElementById("product-meta");
const productNote = document.getElementById("product-note");
const productFeatures = document.getElementById("product-features");
const breadcrumbProduct = document.getElementById("breadcrumb-product");
const productThumbs = document.getElementById("product-thumbs");
const productConfig = document.querySelector(".product-config");
const productQty = document.getElementById("product-qty");

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const imageParam = params.get("img");

const product = PRODUCTS.find((item) => item.id === productId) || PRODUCTS[0];
const imageSrc = imageParam && imageParam.startsWith("images/") ? imageParam : product.image;
const images = Array.isArray(product.images) && product.images.length ? [...product.images] : [product.image];

if (imageSrc && !images.includes(imageSrc)) {
  images.unshift(imageSrc);
}

if (!productId || !PRODUCTS.find((item) => item.id === productId)) {
  productNote.textContent = "Producto no encontrado, mostrando el más cercano.";
}

productName.textContent = product.name;
productPrice.textContent = product.price;
breadcrumbProduct.textContent = product.name;
productImage.src = imageSrc;
productImage.alt = product.name;
productDescription.textContent = product.description;
productMeta.textContent = `${product.origin} · ${product.notes} · ${product.weight}`;

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
  productConfig.querySelectorAll(".quick-add-option").forEach((option) => {
    option.addEventListener("click", () => {
      const group = option.dataset.optionGroup;
      productConfig
        .querySelectorAll(`.quick-add-option[data-option-group=\"${group}\"]`)
        .forEach((item) => item.classList.remove("is-selected"));
      option.classList.add("is-selected");
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
}
