function normalizeApiBase(rawBase) {
  let base = String(rawBase || 'https://pro.skydropx.com').trim().replace(/\/$/, '');

  // Accept host-only base URL even if env was copied with /api/v1 suffix.
  base = base.replace(/\/api\/v1$/i, '');

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
    throw new Error(`Skydropx request failed (${response.status}) at ${requestUrl}: ${JSON.stringify(json)}`);
  }

  return json;
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
  const result = await skydropxRequest('/api/v1/quotations', payload);
  return normalizeQuotationsResponse(result);
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
