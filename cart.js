(function () {
  const CART_KEY = "impetus_cart";

  const drawer = document.getElementById("cart-drawer");
  const itemsContainer = document.getElementById("cart-items");
  const subtotalEl = document.getElementById("cart-subtotal");
  const checkoutButton = document.getElementById("cart-checkout");
  const countEls = document.querySelectorAll(".cart-count");

  const formatCurrency = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    return `$${value.toFixed(0)}`;
  };

  const parsePriceValue = (item) => {
    if (typeof item.priceValue === "number" && !Number.isNaN(item.priceValue)) {
      return item.priceValue;
    }
    if (typeof item.price === "string") {
      const match = item.price.match(/\$(\d+)/);
      if (match) {
        return Number(match[1]);
      }
    }
    return 0;
  };

  const readCart = () => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) {
        return { items: [] };
      }
      return JSON.parse(raw);
    } catch (error) {
      return { items: [] };
    }
  };

  const writeCart = (cart) => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (error) {
      // ignore storage errors
    }
    updateCount(cart);
    renderCart(cart);
  };

  const updateCount = (cart = readCart()) => {
    const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
    countEls.forEach((el) => {
      el.textContent = String(count);
      el.classList.toggle("is-hidden", count === 0);
    });
  };

  const renderCart = (cart = readCart()) => {
    if (!itemsContainer) {
      return;
    }

    itemsContainer.innerHTML = "";

    if (!cart.items.length) {
      const empty = document.createElement("p");
      empty.className = "cart-empty";
      empty.textContent = "Tu carrito está vacío.";
      itemsContainer.appendChild(empty);
    } else {
      cart.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "cart-item";

        const img = document.createElement("img");
        img.src = item.image || "";
        img.alt = item.name || "";
        row.appendChild(img);

        const info = document.createElement("div");
        info.className = "cart-item-info";
        const title = document.createElement("p");
        title.className = "cart-item-title";
        title.textContent = item.name || "Producto";
        info.appendChild(title);

        const meta = document.createElement("p");
        meta.className = "cart-item-meta";
        meta.textContent = `${item.size || "—"} · ${item.grind || "—"}`;
        info.appendChild(meta);

        const bottom = document.createElement("div");
        bottom.className = "cart-item-bottom";

        const price = document.createElement("p");
        price.className = "cart-item-price";
        const displayValue = parsePriceValue(item);
        price.textContent =
          displayValue > 0
            ? formatCurrency(displayValue)
            : "—";
        bottom.appendChild(price);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "cart-item-remove";
        remove.textContent = "Eliminar";
        remove.addEventListener("click", () => removeItem(item));
        bottom.appendChild(remove);

        info.appendChild(bottom);
        row.appendChild(info);

        const qty = document.createElement("div");
        qty.className = "cart-item-qty";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.textContent = "-";
        minus.addEventListener("click", () => updateQty(item, -1));

        const count = document.createElement("span");
        count.textContent = String(item.qty);

        const plus = document.createElement("button");
        plus.type = "button";
        plus.textContent = "+";
        plus.addEventListener("click", () => updateQty(item, 1));

        qty.appendChild(minus);
        qty.appendChild(count);
        qty.appendChild(plus);
        row.appendChild(qty);

        itemsContainer.appendChild(row);
      });
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + parsePriceValue(item) * item.qty,
      0
    );
    if (subtotalEl) {
      subtotalEl.textContent = formatCurrency(subtotal);
    }

    if (checkoutButton) {
      checkoutButton.disabled = cart.items.length === 0;
    }
  };

  const findMatchingItem = (cart, item) =>
    cart.items.find(
      (entry) =>
        entry.id === item.id &&
        entry.size === item.size &&
        entry.grind === item.grind
    );

  const addItem = (item) => {
    const cart = readCart();
    const existing = findMatchingItem(cart, item);
    if (existing) {
      existing.qty += item.qty;
    } else {
      cart.items.push(item);
    }
    writeCart(cart);
  };

  const updateQty = (item, delta) => {
    const cart = readCart();
    const existing = findMatchingItem(cart, item);
    if (!existing) {
      return;
    }
    existing.qty = Math.max(1, existing.qty + delta);
    writeCart(cart);
  };

  const removeItem = (item) => {
    const cart = readCart();
    cart.items = cart.items.filter(
      (entry) =>
        !(
          entry.id === item.id &&
          entry.size === item.size &&
          entry.grind === item.grind
        )
    );
    writeCart(cart);
  };

  const open = () => {
    if (!drawer) {
      return;
    }
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const close = () => {
    if (!drawer) {
      return;
    }
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  const checkout = async () => {
    const cart = readCart();
    if (!cart.items.length) {
      return;
    }

    if (cart.items.some((item) => !item.priceId)) {
      console.error("Missing priceId for one or more items.");
      return;
    }

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((item) => ({
            priceId: item.priceId,
            quantity: item.qty,
            size: item.size,
            grind: item.grind,
            name: item.name,
            productId: item.id,
          })),
        }),
      });

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error", error);
    }
  };

  if (checkoutButton) {
    checkoutButton.addEventListener("click", checkout);
  }

  document.querySelectorAll(".cart-button").forEach((button) => {
    button.addEventListener("click", open);
  });

  if (drawer) {
    drawer.addEventListener("click", (event) => {
      if (event.target.matches("[data-cart-close]")) {
        close();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer?.classList.contains("is-open")) {
      close();
    }
  });

  window.Cart = {
    addItem,
    open,
    close,
    renderCart,
  };

  updateCount();
  renderCart();
})();
