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
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Unable to fetch shipping quote' : error.message;
    res.status(statusCode).json({ error: message });
  }
};
