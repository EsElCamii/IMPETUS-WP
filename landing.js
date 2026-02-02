const quickAddModal = document.getElementById("quick-add-modal");
const quickAddTitle = document.getElementById("quick-add-title");
const quickAddSubmit = document.getElementById("quick-add-submit");
const quickAddQty = document.getElementById("quick-add-qty");

const openQuickAdd = (productName) => {
  if (!quickAddModal) {
    return;
  }

  quickAddTitle.textContent = productName;
  quickAddModal.classList.add("is-open");
  quickAddModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  quickAddModal.querySelectorAll(".quick-add-option").forEach((option) => {
    option.classList.remove("is-selected");
  });

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
  const sizeSelected = quickAddModal.querySelector(
    '.quick-add-option.is-selected[data-option-group="size"]'
  );
  const grindSelected = quickAddModal.querySelector(
    '.quick-add-option.is-selected[data-option-group="grind"]'
  );
  const ready = sizeSelected && grindSelected;

  quickAddSubmit.disabled = !ready;
  quickAddSubmit.textContent = ready
    ? "Añade al carrito"
    : "Selecciona opciones";
};

const productAddButtons = document.querySelectorAll(
  ".product-grid-section .add-to-cart"
);

productAddButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".product-card");
    const name = card ? card.querySelector("h3")?.textContent : "";
    openQuickAdd(name || "Producto");
  });
});

if (quickAddModal) {
  quickAddModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-quick-add-close]")) {
      closeQuickAdd();
    }
  });

  quickAddModal.querySelectorAll(".quick-add-option").forEach((option) => {
    option.addEventListener("click", () => {
      const group = option.dataset.optionGroup;
      quickAddModal
        .querySelectorAll(`.quick-add-option[data-option-group="${group}"]`)
        .forEach((item) => item.classList.remove("is-selected"));
      option.classList.add("is-selected");
      updateQuickAddSubmit();
    });
  });

  quickAddModal.querySelectorAll("[data-qty-change]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.qtyChange) || 0;
      const current = Number(quickAddQty.textContent) || 1;
      const next = Math.max(1, current + delta);
      quickAddQty.textContent = String(next);
    });
  });

  quickAddSubmit.addEventListener("click", () => {
    closeQuickAdd();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickAddModal.classList.contains("is-open")) {
      closeQuickAdd();
    }
  });
}
