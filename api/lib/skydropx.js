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

function buildAddressFromOrigin(origin) {
  const street = [origin?.street, origin?.number].filter(Boolean).join(' ').trim();
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
    address1: destination?.street || undefined,
    reference: destination?.reference,
  });
}

function buildQuotePayloadCandidates(payload) {
  const origin = payload?.origin || {};
  const destination = payload?.destination || {};
  const parcelsWithWeightUnit = buildParcels(payload?.parcels, false);
  const parcelsWithMassUnit = buildParcels(payload?.parcels, true);
  const addressFrom = buildAddressFromOrigin(origin);
  const addressTo = buildAddressToDestination(destination);

  return [
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

function normalizeQuotationsResponse(responseBody) {
  const source = Array.isArray(responseBody)
    ? responseBody
    : Array.isArray(responseBody?.data)
      ? responseBody.data
      : Array.isArray(responseBody?.quotations)
        ? responseBody.quotations
        : [];

  return source
    .map((entry) => {
      const optionId = String(entry.id || entry.option_id || '').trim();
      const provider = String(entry.provider?.name || entry.provider || '').trim();
      const service = String(entry.service_level_name || entry.service || entry.name || '').trim();
      const amount = Number(entry.total_pricing || entry.total_price || entry.price || entry.amount || 0);
      const quotationId = String(entry.quotation_id || entry.id || '').trim();
      const estimatedDays = Number(entry.estimated_delivery_days || entry.estimated_days || entry.delivery_days || 0) || null;

      if (!optionId || !quotationId || !provider || !service || !Number.isFinite(amount) || amount <= 0) {
        return null;
      }

      return {
        option_id: optionId,
        provider,
        service,
        price_mxn: Math.round(amount * 100) / 100,
        estimated_days: estimatedDays,
        quotation_id: quotationId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.price_mxn - b.price_mxn);
}

async function createShippingQuote(payload) {
  const candidates = buildQuotePayloadCandidates(payload);
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    try {
      const result = await skydropxRequest('/api/v1/quotations', candidate);
      return normalizeQuotationsResponse(result);
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
  createShipment,
};
