function sanitizeText(value, maxLength = 60) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value)
    .replace(/[|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeCheckoutItems(rawItems, validatedItems) {
  const sourceItems = Array.isArray(rawItems) ? rawItems : [];

  return validatedItems.map((item, index) => {
    const source =
      sourceItems[index] && typeof sourceItems[index] === "object"
        ? sourceItems[index]
        : {};

    return {
      priceId: item.priceId,
      quantity: item.quantity,
      roast: sanitizeText(source.roast, 40),
      grind: sanitizeText(source.grind, 40),
      presentation: sanitizeText(source.presentation || source.size, 24),
    };
  });
}

function serializeCheckoutItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) =>
      [
        item.priceId || "",
        item.quantity || "",
        item.roast || "",
        item.grind || "",
        item.presentation || "",
      ]
        .map((value) => encodeURIComponent(String(value)))
        .join("~")
    )
    .join("|");
}

function parseCheckoutItems(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return raw;
    }
  }

  try {
    return raw.split("|").filter(Boolean).map((entry) => {
      const [priceId = "", quantity = "", roast = "", grind = "", presentation = ""] =
        entry.split("~");

      return {
        priceId: decodeURIComponent(priceId),
        quantity: Number(decodeURIComponent(quantity)) || 0,
        roast: decodeURIComponent(roast),
        grind: decodeURIComponent(grind),
        presentation: decodeURIComponent(presentation),
      };
    });
  } catch (error) {
    return raw;
  }
}

module.exports = {
  normalizeCheckoutItems,
  parseCheckoutItems,
  serializeCheckoutItems,
};
