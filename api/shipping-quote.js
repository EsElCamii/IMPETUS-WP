const { calculateOrderWeightGrams } = require('./lib/catalog');
const { createShippingQuoteDetailed } = require('./lib/skydropx');
const { validateItems, validatePostalCode, storeQuoteSnapshot, createValidationError, QUOTE_TTL_MS } = require('./lib/validation');

const REQUIRED_ORIGIN_ENV_KEYS = [
  'SKYDROPX_ORIGIN_NAME',
  'SKYDROPX_ORIGIN_COMPANY',
  'SKYDROPX_ORIGIN_PHONE',
  'SKYDROPX_ORIGIN_EMAIL',
  'SKYDROPX_ORIGIN_COUNTRY_CODE',
  'SKYDROPX_ORIGIN_POSTAL_CODE',
  'SKYDROPX_ORIGIN_STATE',
  'SKYDROPX_ORIGIN_CITY',
  'SKYDROPX_ORIGIN_COLONY',
  'SKYDROPX_ORIGIN_STREET',
  'SKYDROPX_ORIGIN_NUMBER',
];

function getRequiredEnvVar(key) {
  const value = typeof process.env[key] === 'string' ? process.env[key].trim() : '';
  return value;
}

function getOriginFromEnv() {
  const missing = REQUIRED_ORIGIN_ENV_KEYS.filter((key) => !getRequiredEnvVar(key));
  if (missing.length > 0) {
    throw new Error(`Skydropx origin config missing required env vars: ${missing.join(', ')}`);
  }

  return {
    name: getRequiredEnvVar('SKYDROPX_ORIGIN_NAME'),
    company: getRequiredEnvVar('SKYDROPX_ORIGIN_COMPANY'),
    phone: getRequiredEnvVar('SKYDROPX_ORIGIN_PHONE'),
    email: getRequiredEnvVar('SKYDROPX_ORIGIN_EMAIL'),
    country_code: getRequiredEnvVar('SKYDROPX_ORIGIN_COUNTRY_CODE'),
    postal_code: getRequiredEnvVar('SKYDROPX_ORIGIN_POSTAL_CODE'),
    state: getRequiredEnvVar('SKYDROPX_ORIGIN_STATE'),
    city: getRequiredEnvVar('SKYDROPX_ORIGIN_CITY'),
    colony: getRequiredEnvVar('SKYDROPX_ORIGIN_COLONY'),
    street: getRequiredEnvVar('SKYDROPX_ORIGIN_STREET'),
    number: getRequiredEnvVar('SKYDROPX_ORIGIN_NUMBER'),
  };
}

function normalizeShippingQuoteError(error) {
  const base = {
    statusCode: error?.statusCode || 500,
    error: 'Unable to fetch shipping quote',
    debug_code: 'SHIPPING_QUOTE_FAILED',
  };

  const message = String(error?.message || '');

  if (message.includes('Skydropx credentials are not configured')) {
    return {
      ...base,
      statusCode: 500,
      error: 'No se pudo cotizar el envío por configuración del servidor.',
      debug_code: 'SKYDROPX_CONFIG_MISSING',
    };
  }

  if (message.includes('Skydropx origin config missing')) {
    return {
      ...base,
      statusCode: 500,
      error: 'No se pudo cotizar el envío por configuración del servidor.',
      debug_code: 'SKYDROPX_CONFIG_MISSING',
    };
  }

  if (message.includes('Skydropx auth failed')) {
    return {
      ...base,
      statusCode: 502,
      error: 'No se pudo cotizar el envío en este momento. Intenta nuevamente.',
      debug_code: 'SKYDROPX_AUTH_FAILED',
    };
  }

  if (message.includes('Skydropx request failed')) {
    return {
      ...base,
      statusCode: 502,
      error: 'No se pudo cotizar el envío para este código postal por ahora. Intenta nuevamente.',
      debug_code: 'SKYDROPX_QUOTATION_FAILED',
    };
  }

  if (base.statusCode !== 500) {
    return {
      statusCode: base.statusCode,
      error: error.message,
      debug_code: 'VALIDATION_ERROR',
    };
  }

  return base;
}

const DEFAULT_PARCEL = {
  length_cm: 28,
  width_cm: 20,
  height_cm: 12,
};

function summarizeSkydropxResponse(response) {
  if (Array.isArray(response)) {
    return {
      type: 'array',
      length: response.length,
    };
  }

  if (!response || typeof response !== 'object') {
    return {
      type: typeof response,
      value: response,
    };
  }

  return {
    type: 'object',
    top_level_keys: Object.keys(response).slice(0, 20),
    data_length: Array.isArray(response.data) ? response.data.length : null,
    quotations_length: Array.isArray(response.quotations) ? response.quotations.length : null,
    results_length: Array.isArray(response.results) ? response.results.length : null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const origin = getOriginFromEnv();
    const postalCode = validatePostalCode(req.body?.postal_code);
    const items = validateItems(req.body?.items);
    const totalWeight = calculateOrderWeightGrams(items);

    if (totalWeight <= 0) {
      throw createValidationError('order weight must be greater than 0');
    }

    const quotationPayload = {
      origin,
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

    const quoteResult = await createShippingQuoteDetailed(quotationPayload);
    const options = quoteResult.options;

    if (!options.length) {
      console.warn('[shipping_quote_no_options]', {
        destination_postal_code: postalCode,
        total_weight_grams: totalWeight,
        source_count: quoteResult.source_count,
        normalized_count: quoteResult.normalized_count,
        candidate_index: quoteResult.candidate_index,
        response_summary: summarizeSkydropxResponse(quoteResult.raw_response),
      });
      res.status(404).json({
        error: 'No hay opciones de envío disponibles para este código postal.',
        debug_code: 'NO_SHIPPING_OPTIONS',
      });
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
    const requestPayloadPreview = {
      destination_postal_code: req.body?.postal_code || null,
      items_count: Array.isArray(req.body?.items) ? req.body.items.length : 0,
    };

    console.error('[shipping_quote_error]', {
      debug_code: normalized.debug_code,
      status_code: normalized.statusCode,
      message: error?.message || 'Unknown shipping quote error',
      skydropx_status_code: error?.statusCode || null,
      skydropx_url: error?.requestUrl || null,
      skydropx_response: error?.responseBody || null,
      skydropx_attempts: error?.attempts || null,
      request_payload: requestPayloadPreview,
    });

    res.status(normalized.statusCode).json({
      error: normalized.error,
      debug_code: normalized.debug_code,
    });
  }
};
