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
    sortBy: 'lowest',
  };
  let isFetchingQuote = false;
  let isCheckoutInProgress = false;

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

  const toDisplayLabel = (value, fallback = '') => {
    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = String(value).trim();
      if (normalized && normalized !== '[object Object]') {
        return normalized;
      }
      return fallback;
    }
    if (value && typeof value === 'object') {
      const candidates = [value.name, value.display_name, value.title, value.label, value.code];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' || typeof candidate === 'number') {
          const normalized = String(candidate).trim();
          if (normalized && normalized !== '[object Object]') {
            return normalized;
          }
        }
      }
    }
    return fallback;
  };

  const parseEstimatedDays = (value) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric);
    }
    if (typeof value === 'string') {
      const match = value.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.round(parsed);
        }
      }
    }
    return null;
  };

  const KNOWN_PROVIDER_LABELS = {
    dhl: 'DHL',
    fedex: 'FedEx',
    estafeta: 'Estafeta',
    ninetynineminutes: '99minutos',
    '99minutos': '99minutos',
  };

  const prettifyLabel = (text) => {
    const normalized = String(text || '')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      return '';
    }

    const collapsed = normalized.toLowerCase().replace(/\s+/g, '');
    if (KNOWN_PROVIDER_LABELS[collapsed]) {
      return KNOWN_PROVIDER_LABELS[collapsed];
    }

    return normalized
      .split(' ')
      .map((word) => {
        if (/^\d+$/.test(word)) {
          return word;
        }
        if (word.length <= 3) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const formatEta = (option) => {
    const rawText = toDisplayLabel(
      option.estimated_text || option.estimated_delivery || option.delivery_time || option.transit_time,
      ''
    );
    if (rawText) {
      return rawText;
    }

    const minDays = parseEstimatedDays(option.estimated_min_days || option.min_days || option.eta_min_days);
    const maxDays = parseEstimatedDays(option.estimated_max_days || option.max_days || option.eta_max_days);

    if (minDays && maxDays) {
      if (minDays === maxDays) {
        return minDays === 1 ? '1 día hábil' : `${minDays} días hábiles`;
      }
      return `${Math.min(minDays, maxDays)} a ${Math.max(minDays, maxDays)} días hábiles`;
    }

    const days = parseEstimatedDays(option.estimated_days || option.delivery_days || option.eta_days);
    if (days) {
      return days === 1 ? '1 día hábil' : `${days} días hábiles`;
    }

    return 'Tiempo por confirmar';
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getFriendlyQuoteError = (statusCode, payload) => {
    const debugCode = String(payload?.debug_code || '').trim();
    const rawMessage = String(payload?.error || '').trim();

    if (debugCode === 'NO_SHIPPING_OPTIONS' || statusCode === 404) {
      return 'No hay opciones de envío disponibles para este código postal.';
    }
    if (debugCode === 'SKYDROPX_CONFIG_MISSING') {
      return 'No se pudo cotizar el envío por configuración del servidor.';
    }
    if (debugCode === 'SKYDROPX_AUTH_FAILED' || debugCode === 'SKYDROPX_QUOTATION_FAILED' || statusCode === 502) {
      return 'No se pudo cotizar el envío en este momento. Intenta nuevamente.';
    }
    if (statusCode === 400) {
      return 'Revisa el código postal e intenta de nuevo.';
    }
    if (/Skydropx request failed/i.test(rawMessage)) {
      return 'No se pudo cotizar el envío para este código postal por ahora.';
    }
    return rawMessage || 'No se pudo cotizar el envío.';
  };

  const setQuoteButtonLoading = (isLoading) => {
    if (!quoteButton) {
      return;
    }
    if (!quoteButton.dataset.defaultLabel) {
      quoteButton.dataset.defaultLabel = quoteButton.textContent.trim() || 'Cotizar';
    }
    quoteButton.classList.toggle('is-loading', isLoading);
    quoteButton.textContent = isLoading ? 'Cotizando...' : quoteButton.dataset.defaultLabel;
    quoteButton.disabled = isLoading;
  };

  const setCheckoutButtonLoading = (isLoading) => {
    if (!checkoutButton) {
      return;
    }
    if (!checkoutButton.dataset.defaultLabel) {
      checkoutButton.dataset.defaultLabel = checkoutButton.textContent.trim() || 'Ir a pagar';
    }
    checkoutButton.classList.toggle('is-loading', isLoading);
    checkoutButton.textContent = isLoading ? 'Redirigiendo...' : checkoutButton.dataset.defaultLabel;
    if (isLoading) {
      checkoutButton.disabled = true;
    }
  };

  const getSelectedOption = () =>
    shippingState.options.find((option) => option.option_id === shippingState.selectedOptionId) || null;

  const isSelectableOption = (option) => Boolean(option && option.selectable !== false);

  const updateSummary = (cart = readCart()) => {
    const subtotal = cart.items.reduce((sum, item) => sum + parsePriceValue(item) * item.qty, 0);
    const selectedOption = getSelectedOption();
    const hasSelectableOption = isSelectableOption(selectedOption);
    const shipping = hasSelectableOption ? Number(selectedOption.price_mxn || 0) : 0;

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (shippingEl) {
      shippingEl.textContent = selectedOption
        ? hasSelectableOption
          ? formatCurrency(shipping)
          : 'No disponible'
        : 'Pendiente';
    }
    if (totalEl) totalEl.textContent = formatCurrency(subtotal + shipping);

    if (checkoutButton) {
      checkoutButton.disabled = isCheckoutInProgress || cart.items.length === 0 || !hasSelectableOption;
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

  const OPTION_WARNING_MESSAGES = {
    missing_option_id_original: 'Identificador de tarifa reconstruido automáticamente.',
    missing_provider: 'Proveedor no especificado por la paquetería.',
    missing_service: 'Tipo de servicio no especificado por la paquetería.',
    insufficient_metadata_for_checkout: 'No disponible para finalizar compra.',
  };

  const OPTION_WARNING_PRIORITY = [
    'insufficient_metadata_for_checkout',
    'missing_provider',
    'missing_service',
    'missing_option_id_original',
  ];

  const getOptionNote = (option) => {
    if (!isSelectableOption(option)) {
      return 'No disponible para finalizar compra';
    }

    const warnings = Array.isArray(option?.warnings) ? option.warnings : [];

    for (const warningCode of OPTION_WARNING_PRIORITY) {
      if (warnings.includes(warningCode) && OPTION_WARNING_MESSAGES[warningCode]) {
        return OPTION_WARNING_MESSAGES[warningCode];
      }
    }

    return '';
  };

  const isExpressOption = (option) => {
    const text = `${toDisplayLabel(option?.provider, '')} ${toDisplayLabel(option?.service, '')}`.toLowerCase();
    return /express|priori|same day|mismo día|next day|overnight|urgente/.test(text);
  };

  const getCheapestOptionId = (options) => {
    if (!Array.isArray(options) || !options.length) {
      return null;
    }
    const ranked = [...options]
      .filter((option) => Number.isFinite(Number(option?.price_mxn)))
      .sort((a, b) => Number(a.price_mxn) - Number(b.price_mxn));
    return ranked[0]?.option_id || null;
  };

  const getSortedOptions = (options) => {
    const list = Array.isArray(options) ? [...options] : [];
    switch (shippingState.sortBy) {
      case 'highest':
        list.sort((a, b) => Number(b.price_mxn || 0) - Number(a.price_mxn || 0));
        break;
      case 'lowest':
      default:
        list.sort((a, b) => Number(a.price_mxn || 0) - Number(b.price_mxn || 0));
        break;
    }

    return list;
  };

  const createShippingToolbar = () => {
    const toolbar = document.createElement('div');
    toolbar.className = 'shipping-options-toolbar';

    const label = document.createElement('label');
    label.className = 'shipping-sort-label';
    label.textContent = 'Ordenar por';

    const select = document.createElement('select');
    select.className = 'shipping-sort-select';
    select.innerHTML = `
      <option value="lowest">Menor costo</option>
      <option value="highest">Mayor costo</option>
    `;
    select.value = shippingState.sortBy;
    select.addEventListener('change', () => {
      shippingState.sortBy = select.value;
      renderShippingOptions();
    });

    label.appendChild(select);
    toolbar.appendChild(label);
    return toolbar;
  };

  const createShippingOptionRow = (option, context = {}) => {
    const label = document.createElement('label');
    label.className = 'shipping-option';
    const selectable = isSelectableOption(option);
    if (!selectable) {
      label.classList.add('is-disabled');
    }

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'shipping-option';
    radio.value = option.option_id;
    radio.checked = selectable && shippingState.selectedOptionId === option.option_id;
    radio.disabled = !selectable;
    if (selectable) {
      radio.addEventListener('change', () => {
        shippingState.selectedOptionId = option.option_id;
        updateSummary(readCart());
        renderShippingOptions();
      });
    }

    const copy = document.createElement('div');
    copy.className = 'shipping-option-copy';
    const provider = prettifyLabel(toDisplayLabel(option.provider, 'Paquetería'));
    const service = prettifyLabel(toDisplayLabel(option.service, ''));
    const eta = formatEta(option);
    const serviceText =
      service && service.toLowerCase() !== provider.toLowerCase() ? service : 'Servicio estándar';

    const titleEl = document.createElement('strong');
    titleEl.textContent = provider;
    const serviceEl = document.createElement('span');
    serviceEl.textContent = serviceText;
    const etaEl = document.createElement('span');
    etaEl.className = 'shipping-option-meta';
    etaEl.textContent = `Entrega: ${eta}`;

    const badges = [];
    if (option?.option_id && option.option_id === context.cheapestOptionId) {
      badges.push('Menor costo');
    }
    if (isExpressOption(option)) {
      badges.push('Express');
    }

    if (badges.length) {
      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'shipping-option-tags';
      badges.forEach((badgeText) => {
        const badge = document.createElement('span');
        badge.className = 'shipping-option-tag';
        badge.textContent = badgeText;
        badgesWrap.appendChild(badge);
      });
      copy.appendChild(badgesWrap);
    }

    copy.appendChild(titleEl);
    copy.appendChild(serviceEl);
    copy.appendChild(etaEl);

    const note = getOptionNote(option);
    if (note) {
      const noteEl = document.createElement('span');
      noteEl.className = 'shipping-option-note';
      noteEl.textContent = note;
      copy.appendChild(noteEl);
    }

    const price = document.createElement('span');
    price.className = 'shipping-option-price';
    price.textContent = formatCurrency(Number(option.price_mxn || 0));

    label.classList.toggle('is-selected', shippingState.selectedOptionId === option.option_id);
    label.appendChild(radio);
    label.appendChild(copy);
    label.appendChild(price);
    return label;
  };

  const renderShippingOptions = () => {
    if (!optionsContainer) {
      return;
    }

    optionsContainer.innerHTML = '';
    optionsContainer.appendChild(createShippingToolbar());

    const sortedOptions = getSortedOptions(shippingState.options);
    const context = { cheapestOptionId: getCheapestOptionId(shippingState.options) };

    sortedOptions.forEach((option) => {
      optionsContainer.appendChild(createShippingOptionRow(option, context));
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
    if (isFetchingQuote) {
      return;
    }

    const cart = readCart();
    if (!cart.items.length) {
      return;
    }

    const postalCode = (postalInput?.value || '').trim();
    if (!/^\d{5}$/.test(postalCode)) {
      resetShippingQuote('Ingresa un código postal válido de 5 dígitos.');
      return;
    }

    isFetchingQuote = true;
    setQuoteButtonLoading(true);
    if (quoteFeedback) {
      quoteFeedback.textContent = 'Consultando opciones de envío...';
    }

    try {
      let response = null;
      let data = null;

      const maxQuoteAttempts = 4;
      for (let attempt = 0; attempt < maxQuoteAttempts; attempt += 1) {
        response = await fetch('/api/shipping-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postal_code: postalCode,
            items: cart.items.map((item) => ({ priceId: item.priceId, quantity: item.qty })),
          }),
        });

        try {
          data = await response.json();
        } catch (parseError) {
          data = null;
        }

        const transientNoOptions = response.status === 404 && data?.debug_code === 'NO_SHIPPING_OPTIONS';
        const canRetryNoOptions = transientNoOptions && attempt < maxQuoteAttempts - 1;
        if (canRetryNoOptions) {
          await delay(700 + attempt * 500);
          continue;
        }

        break;
      }

      if (!response || !response.ok) {
        throw new Error(getFriendlyQuoteError(response?.status || 500, data));
      }

      shippingState.quoteId = data.quote_id;
      shippingState.quoteToken = data.quote_token;
      shippingState.options = Array.isArray(data.options) ? data.options : [];
      shippingState.postalCode = postalCode;
      const firstRecommendedSelectable = shippingState.options.find(
        (option) => option?.quality !== 'fallback' && isSelectableOption(option)
      );
      const firstSelectable = shippingState.options.find((option) => isSelectableOption(option));
      shippingState.selectedOptionId = firstRecommendedSelectable?.option_id || firstSelectable?.option_id || null;

      if (!shippingState.options.length) {
        throw new Error('No hay opciones de envío disponibles para este código postal.');
      }

      renderShippingOptions();
      updateSummary(cart);
      if (quoteFeedback) {
        if (!firstSelectable) {
          quoteFeedback.textContent = 'Hay opciones informativas, pero ninguna disponible para finalizar compra.';
        } else {
          quoteFeedback.textContent = 'Selecciona una opción de envío para continuar.';
        }
      }
    } catch (error) {
      const isNetworkError = error?.name === 'TypeError' && /fetch/i.test(String(error?.message || ''));
      const friendlyMessage = isNetworkError
        ? 'No se pudo conectar para cotizar envío. Intenta nuevamente.'
        : error.message || 'No se pudo cotizar el envío';
      resetShippingQuote(friendlyMessage);
    } finally {
      isFetchingQuote = false;
      setQuoteButtonLoading(false);
    }
  };

  const checkout = async () => {
    if (isCheckoutInProgress) {
      return;
    }

    const cart = readCart();
    if (!cart.items.length) {
      return;
    }

    if (cart.items.some((item) => !item.priceId)) {
      console.error('Missing priceId for one or more items.');
      return;
    }

    const selectedOption = getSelectedOption();

    if (!shippingState.quoteId || !shippingState.selectedOptionId || !selectedOption) {
      if (quoteFeedback) {
        quoteFeedback.textContent = 'Primero cotiza y selecciona un envío.';
      }
      return;
    }

    if (!isSelectableOption(selectedOption)) {
      if (quoteFeedback) {
        quoteFeedback.textContent = 'La opción de envío seleccionada no está disponible para finalizar compra.';
      }
      return;
    }

    try {
      isCheckoutInProgress = true;
      setCheckoutButtonLoading(true);

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

      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        data = null;
      }
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo iniciar el pago.');
      }
      if (!data?.url) {
        throw new Error('No se recibió el enlace de pago. Intenta nuevamente.');
      }
      window.location.assign(data.url);
    } catch (error) {
      if (quoteFeedback) {
        quoteFeedback.textContent = error.message || 'No se pudo iniciar el pago.';
      }
      console.error('Checkout error', error);
    } finally {
      isCheckoutInProgress = false;
      setCheckoutButtonLoading(false);
      updateSummary(readCart());
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
