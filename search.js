const searchForms = document.querySelectorAll(".search");
const searchProducts =
  typeof PRODUCTS !== "undefined" ? PRODUCTS : window.PRODUCTS || [];

const buildResultItem = (product) => {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "search-result";

  const img = document.createElement("img");
  img.src = product.image || "";
  img.alt = product.name || "Producto";

  const content = document.createElement("div");
  content.className = "search-result-content";
  const title = document.createElement("div");
  title.className = "search-result-title";
  title.textContent = product.name || "Producto";

  const meta = document.createElement("div");
  meta.className = "search-result-meta";
  const origin = product.origin ? product.origin : "";
  const notes = product.notes ? ` · ${product.notes}` : "";
  const price = product.price ? ` · ${product.price}` : "";
  meta.textContent = `${origin}${notes}${price}`.trim();

  content.appendChild(title);
  content.appendChild(meta);
  item.appendChild(img);
  item.appendChild(content);

  item.addEventListener("click", () => {
    const target = `product.html?id=${encodeURIComponent(product.id)}&img=${encodeURIComponent(product.image)}`;
    window.location.href = target;
  });

  return item;
};

const filterProducts = (query) => {
  const normalized = query.toLowerCase().trim();
  if (!normalized) {
    return [];
  }
  return searchProducts.filter((product) => {
    const haystack = [
      product.name,
      product.description,
      product.origin,
      product.notes,
      product.badge,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
};

const updateResults = (resultsEl, query) => {
  resultsEl.innerHTML = "";
  const matches = filterProducts(query).slice(0, 5);

  if (!query.trim()) {
    resultsEl.classList.remove("is-open");
    return;
  }

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "No encontramos resultados.";
    resultsEl.appendChild(empty);
  } else {
    matches.forEach((product) => {
      resultsEl.appendChild(buildResultItem(product));
    });
  }

  resultsEl.classList.add("is-open");
};

searchForms.forEach((form) => {
  const input = form.querySelector('input[type="search"]');
  const resultsEl = form.parentElement?.querySelector(".search-results");

  if (!input || !resultsEl) {
    return;
  }

  let debounceTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateResults(resultsEl, input.value || "");
    }, 120);
  });

  input.addEventListener("focus", () => {
    if (input.value) {
      updateResults(resultsEl, input.value);
    }
  });

  document.addEventListener("click", (event) => {
    const within = form.parentElement?.contains(event.target);
    if (!within) {
      resultsEl.classList.remove("is-open");
    }
  });
});
