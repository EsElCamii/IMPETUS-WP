const { calculateOrderWeightGrams } = require('./lib/catalog');
const { createShippingQuoteDetailed } = require('./lib/skydropx');
const { validateItems, validatePostalCode, createValidationError } = require('./lib/validation');

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

const DEFAULT_PARCEL = {
  length_cm: 28,
  width_cm: 20,
  height_cm: 12,
};

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
    error: 'Unable to test shipping quote',
    debug_code: 'SHIPPING_QUOTE_TEST_FAILED',
  };

  const message = String(error?.message || '');

  if (message.includes('Skydropx credentials are not configured')) {
    return {
      ...base,
      statusCode: 500,
      error: 'No se pudo cotizar el envio por configuracion del servidor.',
      debug_code: 'SKYDROPX_CONFIG_MISSING',
    };
  }

  if (message.includes('Skydropx origin config missing')) {
    return {
      ...base,
      statusCode: 500,
      error: 'No se pudo cotizar el envio por configuracion del servidor.',
      debug_code: 'SKYDROPX_CONFIG_MISSING',
    };
  }

  if (message.includes('Skydropx auth failed')) {
    return {
      ...base,
      statusCode: 502,
      error: 'No se pudo cotizar el envio en este momento. Intenta nuevamente.',
      debug_code: 'SKYDROPX_AUTH_FAILED',
    };
  }

  if (message.includes('Skydropx request failed')) {
    return {
      ...base,
      statusCode: 502,
      error: 'No se pudo cotizar el envio para este codigo postal por ahora. Intenta nuevamente.',
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
    rates_type: Array.isArray(response.rates) ? 'array' : typeof response.rates,
    rates_length: Array.isArray(response.rates)
      ? response.rates.length
      : response.rates && typeof response.rates === 'object'
        ? Object.keys(response.rates).length
        : null,
  };
}

function pickText(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const text = String(candidate).trim();
      if (text && text !== '[object Object]') {
        return text;
      }
      continue;
    }

    if (candidate && typeof candidate === 'object') {
      const nestedText = pickText(
        candidate.name,
        candidate.display_name,
        candidate.title,
        candidate.label,
        candidate.code,
        candidate.service_level_name,
        candidate.description
      );
      if (nestedText) {
        return nestedText;
      }
    }
  }
  return '';
}

function pickEstimatedDays(value) {
  const dayCandidates = [
    value?.estimated_delivery_days,
    value?.estimated_days,
    value?.delivery_days,
    value?.delivery_time_days,
    value?.eta_days,
    value?.eta,
    value?.eta_min,
    value?.eta_max,
    value?.eta_business_days,
    value?.transit_days,
    value?.business_days,
    value?.min_days,
    value?.max_days,
  ];

  for (const candidate of dayCandidates) {
    if (candidate === null || candidate === undefined || candidate === '') {
      continue;
    }

    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.round(numeric);
    }

    if (typeof candidate === 'string') {
      const match = candidate.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        const parsed = Number(match[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return Math.round(parsed);
        }
      }
    }
  }

  return null;
}

function extractQuotationEntries(responseBody) {
  if (Array.isArray(responseBody)) {
    return responseBody;
  }

  const candidates = [
    responseBody?.data,
    responseBody?.quotations,
    responseBody?.results,
    responseBody?.items,
    responseBody?.rates,
    responseBody?.quotation_scope?.rates,
    responseBody?.data?.rates,
    responseBody?.data?.quotations,
    responseBody?.data?.results,
    responseBody?.quotation,
  ];

  for (const candidate of candidates) {
    const entries = toEntryArray(candidate);
    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

function toEntryArray(candidate) {
  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate)) {
    return candidate;
  }

  if (typeof candidate === 'object') {
    const entries = [];
    for (const [key, value] of Object.entries(candidate)) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item === 'object') {
            entries.push({ ...item, __rate_key: key });
          }
        });
        continue;
      }

      if (value && typeof value === 'object') {
        entries.push({ ...value, __rate_key: key });
      }
    }

    if (entries.length > 0) {
      return entries;
    }

    const isEntryLike = [
      'option_id',
      'id',
      'quotation_id',
      'quote_id',
      'price',
      'total_price',
      'total_pricing',
      'amount',
      'provider_name',
      'provider',
      'service',
      'service_level_name',
      'type',
      'eta',
    ].some((key) => key in candidate);

    if (isEntryLike) {
      return [candidate];
    }
  }

  return [];
}

function flattenQuotationEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return {};
  }

  const nested = entry.attributes && typeof entry.attributes === 'object' ? entry.attributes : {};
  const quotationNested = entry.quotation && typeof entry.quotation === 'object' ? entry.quotation : {};
  const pricingNested = entry.pricing && typeof entry.pricing === 'object' ? entry.pricing : {};
  const serviceNested = entry.service && typeof entry.service === 'object' ? entry.service : {};
  const providerNested = entry.provider && typeof entry.provider === 'object' ? entry.provider : {};

  return {
    ...entry,
    ...nested,
    ...quotationNested,
    pricing: pricingNested,
    service: serviceNested,
    provider: entry.provider,
    provider_name: entry.provider_name || providerNested.name || providerNested.display_name || undefined,
    service_name: entry.service_name || serviceNested.name || serviceNested.service_level_name || undefined,
  };
}

function hasExpressIndicator(entry) {
  const candidate = pickText(
    entry?.type,
    entry?.service_type,
    entry?.delivery_type,
    entry?.service_level_name,
    entry?.service_name,
    entry?.service?.name,
    entry?.product,
    entry?.name
  );
  return /express/i.test(candidate);
}

function hasEtaIndicator(entry) {
  const etaDays = pickEstimatedDays(entry);
  if (etaDays) {
    return true;
  }

  const etaText = pickText(
    entry?.estimated_delivery_text,
    entry?.estimated_delivery,
    entry?.delivery_time_text,
    entry?.delivery_time,
    entry?.transit_time,
    entry?.eta_text,
    entry?.eta,
    entry?.estimated_arrival,
    entry?.delivery_promise,
    entry?.promise,
    entry?.schedule,
    entry?.service_level?.delivery_time,
    entry?.service_level?.estimated_delivery
  );

  return Boolean(etaText);
}

function makeRawEntrySample(entries) {
  return entries.slice(0, 20).map((entry, index) => ({
    index,
    option_id: pickText(entry.option_id, entry.id, entry.quote_id, entry.quotation_id, entry.rate_id) || null,
    quotation_id: pickText(entry.quotation_id, entry.quote_id, entry.id) || null,
    provider: pickText(
      entry.provider_name,
      entry.provider?.name,
      entry.provider?.display_name,
      entry.carrier,
      entry.courier,
      entry.company,
      entry.provider
    ) || null,
    service: pickText(
      entry.type,
      entry.service_type,
      entry.delivery_type,
      entry.service_level_name,
      entry.service_name,
      entry.service?.name,
      entry.product,
      entry.name
    ) || null,
    eta_days: pickEstimatedDays(entry),
    eta_text: pickText(
      entry.estimated_delivery_text,
      entry.estimated_delivery,
      entry.delivery_time_text,
      entry.delivery_time,
      entry.transit_time,
      entry.eta_text,
      entry.eta
    ) || null,
    top_keys: Object.keys(entry).slice(0, 30),
  }));
}

function buildDiagnostics(rawEntries, options) {
  const expressInRaw = rawEntries.filter((entry) => hasExpressIndicator(entry)).length;
  const etaInRaw = rawEntries.filter((entry) => hasEtaIndicator(entry)).length;

  const expressInOptions = (Array.isArray(options) ? options : []).filter((option) =>
    /express/i.test(String(option?.service || ''))
  ).length;

  const etaInOptions = (Array.isArray(options) ? options : []).filter((option) => {
    const days = Number(option?.estimated_days);
    const hasDays = Number.isFinite(days) && days > 0;
    const hasText = Boolean(String(option?.estimated_text || '').trim());
    return hasDays || hasText;
  }).length;

  const findings = [];
  if (expressInRaw > 0 && expressInOptions === 0) {
    findings.push('raw_has_express_but_normalized_service_missing');
  }
  if (etaInRaw > 0 && etaInOptions === 0) {
    findings.push('raw_has_eta_but_normalized_eta_missing');
  }
  if (expressInRaw === 0) {
    findings.push('raw_missing_express');
  }
  if (etaInRaw === 0) {
    findings.push('raw_missing_eta');
  }

  return {
    express_in_raw_count: expressInRaw,
    express_in_options_count: expressInOptions,
    eta_in_raw_count: etaInRaw,
    eta_in_options_count: etaInOptions,
    findings,
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
    const includeRaw = req.body?.include_raw === true;
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
    const options = Array.isArray(quoteResult.options) ? quoteResult.options : [];
    const rawEntries = extractQuotationEntries(quoteResult.raw_response).map((entry) =>
      flattenQuotationEntry(entry)
    );

    res.status(200).json({
      postal_code: postalCode,
      strict_count: Number(quoteResult.strict_count || 0),
      fallback_count: Number(quoteResult.fallback_count || 0),
      source_count: Number(quoteResult.source_count || 0),
      normalized_count: Number(quoteResult.normalized_count || 0),
      candidate_index: quoteResult.candidate_index,
      response_summary: summarizeSkydropxResponse(quoteResult.raw_response),
      diagnostics: buildDiagnostics(rawEntries, options),
      raw_entry_sample: makeRawEntrySample(rawEntries),
      options,
      raw_response: includeRaw ? quoteResult.raw_response : undefined,
    });
  } catch (error) {
    const normalized = normalizeShippingQuoteError(error);
    console.error('[order_quote_test_error]', {
      debug_code: normalized.debug_code,
      status_code: normalized.statusCode,
      message: error?.message || 'Unknown order quote test error',
      skydropx_status_code: error?.statusCode || null,
      skydropx_url: error?.requestUrl || null,
      skydropx_response: error?.responseBody || null,
    });

    res.status(normalized.statusCode).json({
      error: normalized.error,
      debug_code: normalized.debug_code,
    });
  }
};
