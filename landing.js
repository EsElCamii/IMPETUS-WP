const quickAddModal = document.getElementById("quick-add-modal");
const quickAddTitle = document.getElementById("quick-add-title");
const quickAddCopy = document.getElementById("quick-add-copy");
const quickAddSubmit = document.getElementById("quick-add-submit");
const quickAddQty = document.getElementById("quick-add-qty");
const quickAddSizeOptions = document.getElementById("quick-add-size-options");
const quickAddRoastOptions = document.getElementById("quick-add-roast-options");
const quickAddGrindOptions = document.getElementById("quick-add-grind-options");
const quickAddTotal = document.getElementById("quick-add-total");
const productsSource =
  typeof PRODUCTS !== "undefined" ? PRODUCTS : window.PRODUCTS || [];
let activeProduct = null;

const slugifyOption = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const getQuickAddSizes = (product) =>
  Array.isArray(product?.sizes) && product.sizes.length
    ? product.sizes
    : [
        {
          label: product?.presentation || "250 gr.",
          grams: product?.weight ? Number.parseInt(product.weight, 10) || 250 : 250,
          price: product?.priceValue || 0,
          priceId: product?.priceId || "",
        },
      ];

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

const renderQuickAddSizes = (product) => {
  const sizes = getQuickAddSizes(product);
  renderOptions(
    quickAddSizeOptions,
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

const renderQuickAddTextOptions = (container, values, group) => {
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

const getSelectedOption = (group) =>
  quickAddModal?.querySelector(
    `.quick-add-option.is-selected[data-option-group="${group}"]`
  ) || null;

const updateQuickAddTotal = () => {
  if (!quickAddTotal || !activeProduct) {
    return;
  }

  const sizeSelected = getSelectedOption("size");
  const sizes = getQuickAddSizes(activeProduct);
  const fallback = sizes[0];
  const unitPrice = Number(sizeSelected?.dataset.price) || fallback?.price || 0;
  const qtyValue = Number(quickAddQty?.textContent) || 1;
  quickAddTotal.textContent = `$${Math.max(1, qtyValue) * unitPrice}`;
};

const updateQuickAddSubmit = () => {
  if (!quickAddSubmit) {
    return;
  }

  const sizeSelected = getSelectedOption("size");
  const roastSelected = getSelectedOption("roast");
  const grindSelected = getSelectedOption("grind");
  const ready = Boolean(activeProduct && sizeSelected && roastSelected && grindSelected);

  quickAddSubmit.disabled = !ready;
  quickAddSubmit.textContent = ready ? "Añadir al carrito" : "Selecciona tueste y molienda";
  updateQuickAddTotal();
};

const openQuickAdd = (product) => {
  if (!quickAddModal || !product) {
    return;
  }

  activeProduct = product;
  if (quickAddTitle) {
    quickAddTitle.textContent = product.name || "Producto";
  }
  if (quickAddCopy) {
    quickAddCopy.textContent =
      product.summary || `${product.origin || ""} · ${product.notes || ""}`.trim();
  }

  renderQuickAddSizes(product);
  renderQuickAddTextOptions(quickAddRoastOptions, product.roastOptions, "roast");
  renderQuickAddTextOptions(quickAddGrindOptions, product.grindOptions, "grind");

  quickAddModal.classList.add("is-open");
  quickAddModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  quickAddModal.querySelectorAll(".quick-add-option").forEach((option) => {
    option.classList.remove("is-selected");
  });

  const defaultSize = getSelectedOption("size") || quickAddModal.querySelector(
    '.quick-add-option[data-option-group="size"]'
  );
  if (defaultSize) {
    defaultSize.classList.add("is-selected");
  }

  if (quickAddQty) {
    quickAddQty.textContent = "1";
  }

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

document
  .querySelectorAll(".product-grid-section .add-to-cart")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".product-card");
      const id = card?.dataset.productId;
      const product = productsSource.find((item) => item.id === id);
      if (product) {
        openQuickAdd(product);
      }
    });
  });

if (quickAddModal) {
  quickAddModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-quick-add-close]")) {
      closeQuickAdd();
      return;
    }

    const option = event.target.closest(".quick-add-option");
    if (!option) {
      return;
    }

    const group = option.dataset.optionGroup;
    quickAddModal
      .querySelectorAll(`.quick-add-option[data-option-group="${group}"]`)
      .forEach((item) => item.classList.remove("is-selected"));
    option.classList.add("is-selected");
    updateQuickAddSubmit();
  });

  quickAddModal.querySelectorAll("[data-qty-change]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!quickAddQty) {
        return;
      }
      const delta = Number(button.dataset.qtyChange) || 0;
      const current = Number(quickAddQty.textContent) || 1;
      quickAddQty.textContent = String(Math.max(1, current + delta));
      updateQuickAddTotal();
    });
  });

  if (quickAddSubmit) {
    quickAddSubmit.addEventListener("click", () => {
      const sizeSelected = getSelectedOption("size");
      const roastSelected = getSelectedOption("roast");
      const grindSelected = getSelectedOption("grind");

      if (!activeProduct || !sizeSelected || !roastSelected || !grindSelected) {
        return;
      }

      const qty = Number(quickAddQty?.textContent) || 1;
      const presentation = sizeSelected.dataset.label || activeProduct.presentation || "";

      window.Cart?.addItem({
        id: activeProduct.id,
        name: activeProduct.name,
        price: activeProduct.price,
        priceValue: Number(sizeSelected.dataset.price) || activeProduct.priceValue,
        priceId: sizeSelected.dataset.priceId || activeProduct.priceId,
        image: activeProduct.image,
        size: presentation,
        presentation,
        roast: roastSelected.dataset.label || roastSelected.textContent.trim(),
        grind: grindSelected.dataset.label || grindSelected.textContent.trim(),
        qty,
      });

      closeQuickAdd();
      window.Cart?.open();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickAddModal.classList.contains("is-open")) {
      closeQuickAdd();
    }
  });
}
