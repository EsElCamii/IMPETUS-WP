(function () {
  const CART_KEY = 'impetus_cart';

  const drawer = document.getElementById('cart-drawer');
  const itemsContainer = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('cart-subtotal');
  const shippingEl = document.getElementById('cart-shipping');
  const totalEl = document.getElementById('cart-total');
  const checkoutButton = document.getElementById('cart-checkout');
  const countEls = document.querySelectorAll('.cart-count');
  const postalInput = document.getElementById('cart-postal-code');
  const quoteButton = document.getElementById('cart-quote-button');
  const quoteFeedback = document.getElementById('cart-shipping-feedback');
  const optionsContainer = document.getElementById('cart-shipping-options');

  const shippingState = {
    quoteId: null,
    quoteToken: null,
    options: [],
    selectedOptionId: null,
    postalCode: '',
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '—';
    }
    return `$${value.toFixed(0)}`;
  };

  const parsePriceValue = (item) => {
    if (typeof item.priceValue === 'number' && !Number.isNaN(item.priceValue)) {
      return item.priceValue;
    }
    if (typeof item.price === 'string') {
      const match = item.price.match(/\$(\d+)/);
      if (match) {
        return Number(match[1]);
      }
    }
    return 0;
  };

  const getSelectedOption = () =>
    shippingState.options.find((option) => option.option_id === shippingState.selectedOptionId) || null;

  const updateSummary = (cart = readCart()) => {
    const subtotal = cart.items.reduce((sum, item) => sum + parsePriceValue(item) * item.qty, 0);
    const selectedOption = getSelectedOption();
    const shipping = selectedOption ? Number(selectedOption.price_mxn || 0) : 0;

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (shippingEl) shippingEl.textContent = selectedOption ? formatCurrency(shipping) : 'Pendiente';
    if (totalEl) totalEl.textContent = formatCurrency(subtotal + shipping);

    if (checkoutButton) {
      checkoutButton.disabled = cart.items.length === 0 || !selectedOption;
    }
  };

  const resetShippingQuote = (message = '') => {
    shippingState.quoteId = null;
    shippingState.quoteToken = null;
    shippingState.options = [];
    shippingState.selectedOptionId = null;

    if (optionsContainer) {
      optionsContainer.innerHTML = '';
    }

    if (quoteFeedback) {
      quoteFeedback.textContent = message;
    }

    updateSummary();
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
    resetShippingQuote('Selecciona código postal y cotiza envío nuevamente.');
  };

  const updateCount = (cart = readCart()) => {
    const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
    countEls.forEach((el) => {
      el.textContent = String(count);
      el.classList.toggle('is-hidden', count === 0);
    });
  };

  const renderShippingOptions = () => {
    if (!optionsContainer) {
      return;
    }

    optionsContainer.innerHTML = '';

    shippingState.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'shipping-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'shipping-option';
      radio.value = option.option_id;
      radio.checked = shippingState.selectedOptionId === option.option_id;
      radio.addEventListener('change', () => {
        shippingState.selectedOptionId = option.option_id;
        updateSummary(readCart());
      });

      const copy = document.createElement('div');
      copy.className = 'shipping-option-copy';
      const eta = option.estimated_days ? `${option.estimated_days} días` : 'Tiempo por confirmar';
      copy.innerHTML = `
        <strong>${option.provider} · ${option.service}</strong>
        <span>Entrega estimada: ${eta}</span>
      `;

      const price = document.createElement('span');
      price.className = 'shipping-option-price';
      price.textContent = formatCurrency(Number(option.price_mxn || 0));

      label.appendChild(radio);
      label.appendChild(copy);
      label.appendChild(price);
      optionsContainer.appendChild(label);
    });
  };

  const renderCart = (cart = readCart()) => {
    if (!itemsContainer) {
      return;
    }

    itemsContainer.innerHTML = '';

    if (!cart.items.length) {
      const empty = document.createElement('p');
      empty.className = 'cart-empty';
      empty.textContent = 'Tu carrito está vacío.';
      itemsContainer.appendChild(empty);
    } else {
      cart.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'cart-item';

        const img = document.createElement('img');
        img.src = item.image || '';
        img.alt = item.name || '';
        row.appendChild(img);

        const info = document.createElement('div');
        info.className = 'cart-item-info';
        const title = document.createElement('p');
        title.className = 'cart-item-title';
        title.textContent = item.name || 'Producto';
        info.appendChild(title);

        const meta = document.createElement('p');
        meta.className = 'cart-item-meta';
        meta.textContent = `${item.size || '—'} · ${item.grind || '—'}`;
        info.appendChild(meta);

        const bottom = document.createElement('div');
        bottom.className = 'cart-item-bottom';

        const price = document.createElement('p');
        price.className = 'cart-item-price';
        const displayValue = parsePriceValue(item);
        price.textContent = displayValue > 0 ? formatCurrency(displayValue) : '—';
        bottom.appendChild(price);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'cart-item-remove';
        remove.textContent = 'Eliminar';
        remove.addEventListener('click', () => removeItem(item));
        bottom.appendChild(remove);

        info.appendChild(bottom);
        row.appendChild(info);

        const qty = document.createElement('div');
        qty.className = 'cart-item-qty';

        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '-';
        minus.addEventListener('click', () => updateQty(item, -1));

        const count = document.createElement('span');
        count.textContent = String(item.qty);

        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.addEventListener('click', () => updateQty(item, 1));

        qty.appendChild(minus);
        qty.appendChild(count);
        qty.appendChild(plus);
        row.appendChild(qty);

        itemsContainer.appendChild(row);
      });
    }

    updateSummary(cart);
  };

  const findMatchingItem = (cart, item) =>
    cart.items.find(
      (entry) => entry.id === item.id && entry.size === item.size && entry.grind === item.grind
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
      (entry) => !(entry.id === item.id && entry.size === item.size && entry.grind === item.grind)
    );
    writeCart(cart);
  };

  const open = () => {
    if (!drawer) {
      return;
    }
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  };

  const close = () => {
    if (!drawer) {
      return;
    }
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  const fetchShippingQuote = async () => {
    const cart = readCart();
    if (!cart.items.length) {
      return;
    }

    const postalCode = (postalInput?.value || '').trim();
    if (!/^\d{5}$/.test(postalCode)) {
      resetShippingQuote('Ingresa un código postal válido de 5 dígitos.');
      return;
    }

    if (quoteButton) {
      quoteButton.disabled = true;
    }
    if (quoteFeedback) {
      quoteFeedback.textContent = 'Consultando opciones de envío...';
    }

    try {
      const response = await fetch('/api/shipping-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postal_code: postalCode,
          items: cart.items.map((item) => ({ priceId: item.priceId, quantity: item.qty })),
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }

      if (!response.ok) {
        const fallbackByStatus = {
          400: 'Revisa el código postal e intenta de nuevo.',
          404: 'No hay opciones de envío disponibles para ese código postal.',
          502: 'No se pudo cotizar el envío en este momento. Intenta nuevamente.',
        };
        throw new Error(data?.error || fallbackByStatus[response.status] || 'No se pudo cotizar el envío');
      }

      shippingState.quoteId = data.quote_id;
      shippingState.quoteToken = data.quote_token;
      shippingState.options = Array.isArray(data.options) ? data.options : [];
      shippingState.postalCode = postalCode;
      shippingState.selectedOptionId = shippingState.options[0]?.option_id || null;

      renderShippingOptions();
      updateSummary(cart);
      if (quoteFeedback) {
        quoteFeedback.textContent = 'Selecciona una opción de envío para continuar.';
      }
    } catch (error) {
      const isNetworkError = error?.name === 'TypeError' && /fetch/i.test(String(error?.message || ''));
      const friendlyMessage = isNetworkError
        ? 'No se pudo conectar para cotizar envío. Intenta nuevamente.'
        : error.message || 'No se pudo cotizar el envío';
      resetShippingQuote(friendlyMessage);
    } finally {
      if (quoteButton) {
        quoteButton.disabled = false;
      }
    }
  };

  const checkout = async () => {
    const cart = readCart();
    if (!cart.items.length) {
      return;
    }

    if (cart.items.some((item) => !item.priceId)) {
      console.error('Missing priceId for one or more items.');
      return;
    }

    if (!shippingState.quoteId || !shippingState.selectedOptionId) {
      if (quoteFeedback) {
        quoteFeedback.textContent = 'Primero cotiza y selecciona un envío.';
      }
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items.map((item) => ({
            priceId: item.priceId,
            quantity: item.qty,
          })),
          quote_id: shippingState.quoteId,
          quote_token: shippingState.quoteToken,
          option_id: shippingState.selectedOptionId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Checkout error');
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      if (quoteFeedback) {
        quoteFeedback.textContent = error.message || 'No se pudo iniciar el pago.';
      }
      console.error('Checkout error', error);
    }
  };

  if (checkoutButton) {
    checkoutButton.addEventListener('click', checkout);
  }

  if (quoteButton) {
    quoteButton.addEventListener('click', fetchShippingQuote);
  }

  document.querySelectorAll('.cart-button').forEach((button) => {
    button.addEventListener('click', open);
  });

  if (drawer) {
    drawer.addEventListener('click', (event) => {
      if (event.target.matches('[data-cart-close]')) {
        close();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer?.classList.contains('is-open')) {
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
  resetShippingQuote('Ingresa tu código postal para cotizar envío.');
})();
