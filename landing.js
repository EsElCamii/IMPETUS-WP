const quickAddModal = document.getElementById("quick-add-modal");
const quickAddTitle = document.getElementById("quick-add-title");
const quickAddSubmit = document.getElementById("quick-add-submit");
const quickAddQty = document.getElementById("quick-add-qty");
const quickAddSizeOptions = document.getElementById("quick-add-size-options");
const quickAddTotal = document.getElementById("quick-add-total");
const quickAddBadge = document.getElementById("quick-add-badge");
const productsSource =
  typeof PRODUCTS !== "undefined"
    ? PRODUCTS
    : window.PRODUCTS || [];
let activeProduct = null;

const getQuickAddSizes = (product) => {
  const sizes = Array.isArray(product?.sizes) && product.sizes.length
    ? product.sizes
    : [
        { label: "250g", grams: 250, price: product?.priceValue || 0 },
        { label: "500g", grams: 500, price: product?.priceValue || 0 },
        { label: "1kg", grams: 1000, price: product?.priceValue || 0 },
      ];
  const minPrice = Math.min(...sizes.map((size) => size.price));
  return { sizes, minPrice };
};

const openQuickAdd = (product) => {
  if (!quickAddModal) {
    return;
  }

  activeProduct = product;
  quickAddTitle.textContent = product?.name || "Producto";
  renderQuickAddSizes(product);
  quickAddModal.classList.add("is-open");
  quickAddModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  quickAddModal.querySelectorAll(".quick-add-option").forEach((option) => {
    option.classList.remove("is-selected");
  });

  const defaultSize =
    quickAddModal.querySelector('.quick-add-option[data-option-group="size"][data-option-value="500g"]') ||
    quickAddModal.querySelector('.quick-add-option[data-option-group="size"]');
  if (defaultSize) {
    defaultSize.classList.add("is-selected");
  }

  const defaultGrind =
    quickAddModal.querySelector('.quick-add-option[data-option-group="grind"][data-option-value="whole"]') ||
    quickAddModal.querySelector('.quick-add-option[data-option-group="grind"]');
  if (defaultGrind) {
    defaultGrind.classList.add("is-selected");
  }

  quickAddQty.textContent = "1";
  updateQuickAddSubmit();
};

const closeQuickAdd = () => {
  if (!quickAddModal) {
    return;
  }

  quickAddModal.classList.remove("is-open");
  quickAddModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
};

const updateQuickAddSubmit = () => {
  if (!quickAddModal || !quickAddSubmit) {
    return;
  }
  const sizeSelected = quickAddModal.querySelector(
    '.quick-add-option.is-selected[data-option-group="size"]'
  );
  const grindSelected = quickAddModal.querySelector(
    '.quick-add-option.is-selected[data-option-group="grind"]'
  );
  const ready = !!(sizeSelected && grindSelected && activeProduct);

  quickAddSubmit.disabled = !ready;
  quickAddSubmit.textContent = ready
    ? "Añade al carrito"
    : "Selecciona opciones";
  updateQuickAddTotal();
};

const updateQuickAddTotal = () => {
  if (!activeProduct || !quickAddModal) {
    return;
  }

  const { minPrice } = getQuickAddSizes(activeProduct);
  const sizeSelected = quickAddModal.querySelector(
    '.quick-add-option.is-selected[data-option-group="size"]'
  );
  const selectedPrice = Number(sizeSelected?.dataset.price);
  const unitPrice = Number.isFinite(selectedPrice) && selectedPrice > 0
    ? selectedPrice
    : minPrice;
  const qtyValue = Number(quickAddQty?.textContent) || 1;
  const totalValue = Math.max(1, qtyValue) * (unitPrice || 0);

  if (quickAddTotal) {
    quickAddTotal.textContent = `$${totalValue}`;
  }

  if (quickAddBadge) {
    if (activeProduct?.badge) {
      quickAddBadge.textContent = activeProduct.badge;
      quickAddBadge.style.display = "";
    } else {
      quickAddBadge.textContent = "";
      quickAddBadge.style.display = "none";
    }
  }
};

const renderQuickAddSizes = (product) => {
  if (!quickAddSizeOptions) {
    return;
  }
  const { sizes, minPrice } = getQuickAddSizes(product);

  quickAddSizeOptions.innerHTML = "";
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

    quickAddSizeOptions.appendChild(button);
  });
};

const productAddButtons = document.querySelectorAll(
  ".product-grid-section .add-to-cart"
);

productAddButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".product-card");
    const id = card?.dataset.productId;
    const product =
      productsSource.find((item) => item.id === id) ||
      (() => {
        const name = card?.querySelector("h3")?.textContent?.trim() || "Producto";
        const priceText =
          card?.querySelector(".price")?.textContent?.trim() || "";
        const match = priceText.match(/\\$\\s*(\\d+)/);
        const priceValue = match ? Number(match[1]) : null;
        const image = card?.querySelector("img")?.getAttribute("src") || "";
        return {
          id: id || name.toLowerCase().replace(/\\s+/g, "-"),
          name,
          price: priceText,
          priceValue,
          priceId: null,
          image,
        };
      })();
    openQuickAdd(product);
  });
});

if (quickAddModal) {
  quickAddModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-quick-add-close]")) {
      closeQuickAdd();
    }
  });

  quickAddModal.addEventListener("click", (event) => {
    const option = event.target.closest(".quick-add-option");
    if (option) {
      const group = option.dataset.optionGroup;
      quickAddModal
        .querySelectorAll(`.quick-add-option[data-option-group="${group}"]`)
        .forEach((item) => item.classList.remove("is-selected"));
      option.classList.add("is-selected");
      updateQuickAddSubmit();
    }
  });

  quickAddModal.querySelectorAll("[data-qty-change]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.qtyChange) || 0;
      const current = Number(quickAddQty.textContent) || 1;
      const next = Math.max(1, current + delta);
      quickAddQty.textContent = String(next);
      updateQuickAddTotal();
    });
  });

  quickAddSubmit.addEventListener("click", () => {
    const sizeSelected = quickAddModal.querySelector(
      '.quick-add-option.is-selected[data-option-group="size"]'
    );
    const grindSelected = quickAddModal.querySelector(
      '.quick-add-option.is-selected[data-option-group="grind"]'
    );

    if (!activeProduct || !sizeSelected || !grindSelected) {
      return;
    }

    const qty = Number(quickAddQty.textContent) || 1;
    window.Cart?.addItem({
      id: activeProduct.id,
      name: activeProduct.name,
      price: activeProduct.price,
      priceValue: Number(sizeSelected.dataset.price),
      priceId: sizeSelected.dataset.priceId || activeProduct.priceId,
      image: activeProduct.image,
      size: sizeSelected.dataset.optionValue || "",
      grind: grindSelected.textContent.trim(),
      qty,
    });

    closeQuickAdd();
    window.Cart?.open();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickAddModal.classList.contains("is-open")) {
      closeQuickAdd();
    }
  });
}
