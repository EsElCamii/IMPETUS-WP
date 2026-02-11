const { calculateOrderWeightGrams } = require('./lib/catalog');
const { createShippingQuote } = require('./lib/skydropx');
const { validateItems, validatePostalCode, storeQuoteSnapshot, createValidationError, QUOTE_TTL_MS } = require('./lib/validation');

const ORIGIN = {
  name: 'IMPETUS',
  company: 'IMPETUS',
  phone: '0000000000',
  email: 'ventas@impetus.mx',
  country_code: 'MX',
  postal_code: '91000',
  state: 'Veracruz',
  city: 'Xalapa',
  colony: 'Centro',
  street: 'Av. Principal',
  number: '1',
};

function normalizeShippingQuoteError(error) {
  const base = {
    statusCode: error?.statusCode || 500,
    error: 'Unable to fetch shipping quote',
    debug_code: 'SHIPPING_QUOTE_FAILED',
  };

  const message = String(error?.message || '');

  if (base.statusCode !== 500) {
    return {
      statusCode: base.statusCode,
      error: error.message,
      debug_code: 'VALIDATION_ERROR',
    };
  }

  if (message.includes('Skydropx credentials are not configured')) {
    return { ...base, debug_code: 'SKYDROPX_CONFIG_MISSING' };
  }

  if (message.includes('Skydropx auth failed')) {
    return { ...base, debug_code: 'SKYDROPX_AUTH_FAILED' };
  }

  if (message.includes('Skydropx request failed')) {
    return { ...base, debug_code: 'SKYDROPX_QUOTATION_FAILED' };
  }

  return base;
}

const DEFAULT_PARCEL = {
  length_cm: 28,
  width_cm: 20,
  height_cm: 12,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const postalCode = validatePostalCode(req.body?.postal_code);
    const items = validateItems(req.body?.items);
    const totalWeight = calculateOrderWeightGrams(items);

    if (totalWeight <= 0) {
      throw createValidationError('order weight must be greater than 0');
    }

    const quotationPayload = {
      origin: ORIGIN,
      destination: {
        country_code: 'MX',
        postal_code: postalCode,
      },
      parcels: [
        {
          weight: Number((totalWeight / 1000).toFixed(3)),
          weight_unit: 'kg',
          length: DEFAULT_PARCEL.length_cm,
          width: DEFAULT_PARCEL.width_cm,
          height: DEFAULT_PARCEL.height_cm,
          distance_unit: 'cm',
        },
      ],
    };

    const options = await createShippingQuote(quotationPayload);

    if (!options.length) {
      res.status(404).json({ error: 'No shipping options available for this destination' });
      return;
    }

    const snapshot = {
      postal_code: postalCode,
      items,
      total_weight_grams: totalWeight,
      options,
    };

    const { quoteId, signedQuote, expiresAt } = storeQuoteSnapshot(snapshot);

    res.status(200).json({
      quote_id: quoteId,
      quote_token: signedQuote,
      expires_at: expiresAt,
      ttl_ms: QUOTE_TTL_MS,
      options,
    });
  } catch (error) {
    const normalized = normalizeShippingQuoteError(error);

    console.error('[shipping_quote_error]', {
      debug_code: normalized.debug_code,
      status_code: normalized.statusCode,
      message: error?.message || 'Unknown shipping quote error',
    });

    res.status(normalized.statusCode).json({
      error: normalized.error,
      debug_code: normalized.debug_code,
    });
  }
};
