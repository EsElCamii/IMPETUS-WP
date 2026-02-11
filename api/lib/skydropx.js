function normalizeApiBase(rawBase) {
  let base = String(rawBase || 'https://pro.skydropx.com').trim();

  if (!base) {
    base = 'https://pro.skydropx.com';
  }

  // Accept host value even if scheme was omitted in env vars.
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }

  base = base.replace(/\/+$/, '');

  // Accept host-only base URL even if env was copied with /api/v1 suffix.
  base = base.replace(/\/api\/v1$/i, '');
  base = base.replace(/\/api$/i, '');

  // Backward-compatible fix for legacy host values.
  if (/^https?:\/\/api\.skydropx\.com$/i.test(base)) {
    return 'https://pro.skydropx.com';
  }

  return base;
}

const SKYDROPX_API_BASE = normalizeApiBase(process.env.SKYDROPX_API_BASE);

const tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

function isTokenValid() {
  return tokenCache.accessToken && Date.now() < tokenCache.expiresAt;
}

async function requestToken() {
  const clientId = process.env.SKYDROPX_CLIENT_ID;
  const clientSecret = process.env.SKYDROPX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Skydropx credentials are not configured');
  }

  const tokenUrl = `${SKYDROPX_API_BASE}/api/v1/oauth/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const body = await safeReadJson(response);
    throw new Error(`Skydropx auth failed (${response.status}) at ${tokenUrl}: ${JSON.stringify(body)}`);
  }

  const payload = await response.json();
  const expiresIn = Number(payload.expires_in || 0);
  if (!payload.access_token || !expiresIn) {
    throw new Error('Skydropx auth response missing access_token or expires_in');
  }

  tokenCache.accessToken = payload.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(1, expiresIn - 60) * 1000;

  return tokenCache.accessToken;
}

async function getSkydropxToken(forceRefresh = false) {
  if (!forceRefresh && isTokenValid()) {
    return tokenCache.accessToken;
  }
  return requestToken();
}

async function skydropxRequest(path, payload, attempt = 0) {
  const token = await getSkydropxToken(attempt > 0);
  const requestUrl = `${SKYDROPX_API_BASE}${path}`;

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401 && attempt === 0) {
    return skydropxRequest(path, payload, 1);
  }

  const json = await safeReadJson(response);

  if (!response.ok) {
    const error = new Error(`Skydropx request failed (${response.status}) at ${requestUrl}: ${JSON.stringify(json)}`);
    error.statusCode = response.status;
    error.requestUrl = requestUrl;
    error.responseBody = json;
    error.requestPayload = payload;
    throw error;
  }

  return json;
}

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeObject);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || val === null || val === '') {
      continue;
    }
    result[key] = sanitizeObject(val);
  }
  return result;
}

function buildParcels(parcels, useMassUnit) {
  return (Array.isArray(parcels) ? parcels : []).map((parcel) => {
    const weight = Number(parcel?.weight || 0);
    const length = Number(parcel?.length || 0);
    const width = Number(parcel?.width || 0);
    const height = Number(parcel?.height || 0);
    const distanceUnit = String(parcel?.distance_unit || parcel?.distanceUnit || 'cm');
    const weightUnit = String(parcel?.weight_unit || parcel?.weightUnit || parcel?.mass_unit || 'kg');

    return sanitizeObject({
      weight,
      length,
      width,
      height,
      distance_unit: useMassUnit ? distanceUnit.toUpperCase() : distanceUnit.toLowerCase(),
      weight_unit: useMassUnit ? undefined : weightUnit.toLowerCase(),
      mass_unit: useMassUnit ? weightUnit.toUpperCase() : undefined,
    });
  });
}

function buildStreet(address) {
  return [address?.street, address?.number].filter(Boolean).join(' ').trim();
}

function getAreaLevel(address, key, fallback = 'N/A') {
  const value = String(address?.[key] || '').trim();
  if (value) {
    return value;
  }
  return fallback;
}

function buildAddressFromOrigin(origin) {
  const street = buildStreet(origin);
  return sanitizeObject({
    name: origin?.name || 'IMPETUS',
    company: origin?.company || 'IMPETUS',
    phone: origin?.phone || '5511111111',
    email: origin?.email || undefined,
    zip: origin?.postal_code,
    country: origin?.country_code || origin?.country || 'MX',
    province: origin?.state,
    city: origin?.city,
    neighborhood: origin?.colony,
    address1: street || undefined,
    reference: origin?.colony,
  });
}

function buildAddressToDestination(destination) {
  const street = buildStreet(destination);
  return sanitizeObject({
    name: destination?.name || 'Cliente IMPETUS',
    company: destination?.company || undefined,
    phone: destination?.phone || '5511111111',
    email: destination?.email || undefined,
    zip: destination?.postal_code,
    country: destination?.country_code || destination?.country || 'MX',
    province: destination?.state,
    city: destination?.city,
    neighborhood: destination?.colony,
    address1: street || undefined,
    reference: destination?.reference,
  });
}

function buildAddressV1(address, isDestination = false) {
  const street = buildStreet(address);
  const defaultReference = isDestination ? 'Cotizacion web' : 'Origen IMPETUS';

  return sanitizeObject({
    country_code: address?.country_code || address?.country || 'MX',
    postal_code: address?.postal_code || address?.zip || undefined,
    area_level1: getAreaLevel(address, 'state'),
    area_level2: getAreaLevel(address, 'city'),
    area_level3: getAreaLevel(address, 'colony'),
    company: address?.company || (isDestination ? 'Cliente' : 'IMPETUS'),
    name: address?.name || (isDestination ? 'Cliente IMPETUS' : 'IMPETUS'),
    phone: address?.phone || '5511111111',
    email: address?.email || undefined,
    street1: street || 'N/A',
    reference: address?.reference || address?.colony || defaultReference,
  });
}

function buildQuotePayloadCandidates(payload) {
  const origin = payload?.origin || {};
  const destination = payload?.destination || {};
  const parcelsWithWeightUnit = buildParcels(payload?.parcels, false);
  const parcelsWithMassUnit = buildParcels(payload?.parcels, true);
  const addressFrom = buildAddressFromOrigin(origin);
  const addressTo = buildAddressToDestination(destination);
  const addressFromV1 = buildAddressV1(origin, false);
  const addressToV1 = buildAddressV1(destination, true);

  return [
    sanitizeObject({
      quotation: {
        address_from: addressFromV1,
        address_to: addressToV1,
        parcels: parcelsWithMassUnit,
      },
    }),
    sanitizeObject({
      quotation: {
        address_from: addressFromV1,
        address_to: addressToV1,
        parcels: parcelsWithWeightUnit,
      },
    }),
    sanitizeObject({
      address_from: addressFromV1,
      address_to: addressToV1,
      parcels: parcelsWithMassUnit,
    }),
    sanitizeObject({
      address_from: addressFromV1,
      address_to: addressToV1,
      parcels: parcelsWithWeightUnit,
    }),
    sanitizeObject(payload),
    sanitizeObject({
      origin,
      destination,
      parcels: parcelsWithMassUnit,
    }),
    sanitizeObject({
      address_from: addressFrom,
      address_to: addressTo,
      parcels: parcelsWithMassUnit,
    }),
    sanitizeObject({
      shipment: {
        address_from: addressFrom,
        address_to: addressTo,
        parcels: parcelsWithMassUnit,
      },
    }),
    sanitizeObject({
      address_from: {
        zip: addressFrom.zip,
        country: addressFrom.country,
      },
      address_to: {
        zip: addressTo.zip,
        country: addressTo.country,
      },
      parcels: parcelsWithWeightUnit,
    }),
  ];
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
    value.estimated_delivery_days,
    value.estimated_days,
    value.delivery_days,
    value.delivery_time_days,
    value.eta_days,
    value.transit_days,
    value.business_days,
    value.min_days,
    value.max_days,
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

function pickEstimatedText(value) {
  const text = pickText(
    value.estimated_delivery_text,
    value.estimated_delivery,
    value.delivery_time_text,
    value.delivery_time_label,
    value.delivery_time,
    value.transit_time,
    value.eta_text,
    value.eta,
    value.estimated_arrival,
    value.delivery_promise,
    value.promise,
    value.schedule,
    value.service_level?.delivery_time,
    value.service_level?.estimated_delivery
  );

  if (!text || /^\d+$/.test(text)) {
    return null;
  }

  return text;
}

function normalizeQuotationsResponse(responseBody) {
  const source = extractQuotationEntries(responseBody);

  return source
    .map((entry) => {
      const value = flattenQuotationEntry(entry);
      const optionId = String(
        value.option_id ||
        value.id ||
        value.quote_id ||
        value.quotation_id ||
        value.rate_id ||
        value.service_code ||
        value.__rate_key ||
        ''
      ).trim();
      const provider =
        pickText(
          value.provider_name,
          value.provider?.name,
          value.provider?.display_name,
          value.provider?.title,
          value.provider?.label,
          value.carrier,
          value.courier,
          value.company,
          value.__rate_key,
          value.provider
        ) || 'Proveedor';
      const service =
        pickText(
          value.service_level_name,
          value.service_level?.name,
          value.service_name,
          value.service?.name,
          value.service?.service_level_name,
          value.delivery_type,
          value.product,
          value.name,
          value.service_code,
          value.service
        ) || 'Servicio estándar';
      const amount = pickFiniteNumber(
        value.total_pricing ||
        value.total_price ||
        value.total ||
        value.total_cost ||
        value.total_amount ||
        value.final_price ||
        value.rate ||
        value.cost ||
        value.price ||
        value.amount ||
        value.pricing?.total ||
        value.pricing?.price ||
        value.pricing?.amount ||
        value.pricing?.final_price ||
        value.cost_breakdown?.total ||
        0
      );
      const quotationId = String(value.quotation_id || value.quote_id || value.id || optionId || '').trim();
      const estimatedDays = pickEstimatedDays(value);
      const estimatedText = pickEstimatedText(value);

      if (!optionId || !quotationId || !Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      return {
        option_id: optionId,
        provider,
        service,
        price_mxn: Math.round(amount * 100) / 100,
        estimated_days: estimatedDays,
        estimated_text: estimatedText,
        quotation_id: quotationId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.price_mxn - b.price_mxn);
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
      'name',
    ].some((key) => key in candidate);

    if (isEntryLike) {
      return [candidate];
    }

    return entries;
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

function pickFiniteNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return num;
}

async function createShippingQuote(payload) {
  const details = await createShippingQuoteDetailed(payload);
  return details.options;
}

async function createShippingQuoteDetailed(payload) {
  const candidates = buildQuotePayloadCandidates(payload);
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const result = await skydropxRequest('/api/v1/quotations', candidate);
      const source = extractQuotationEntries(result);
      const options = normalizeQuotationsResponse(result);

      return {
        options,
        source_count: source.length,
        normalized_count: options.length,
        candidate_index: i,
        raw_response: result,
      };
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      const isRetryableInvalidPayload = statusCode === 400 && i < candidates.length - 1;
      if (isRetryableInvalidPayload) {
        lastError = error;
        continue;
      }
      if (statusCode === 400) {
        error.attempts = candidates.length;
      }
      throw error;
    }
  }

  if (lastError) {
    lastError.attempts = candidates.length;
    throw lastError;
  }

  throw new Error('Skydropx quotation failed with no payload candidates to try');
}

async function createShipment(payload) {
  return skydropxRequest('/api/v1/shipments', payload);
}

async function safeReadJson(response) {
  try {
    const text = await response.text();
    if (!text) {
      return { message: 'Empty response body' };
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      return { message: text.slice(0, 1000) };
    }
  } catch (error) {
    return { message: 'Failed to read response body' };
  }
}

module.exports = {
  getSkydropxToken,
  createShippingQuote,
  createShippingQuoteDetailed,
  createShipment,
};
