const crypto = require('crypto');
const { ALLOWED_PRICE_IDS } = require('./catalog');

const QUOTE_TTL_MS = 30 * 60 * 1000;
const quoteStore = new Map();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toSafeInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    return fallback;
  }
  return num;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw createValidationError('items must be a non-empty array');
  }

  return items.map((item) => {
    if (!isPlainObject(item)) {
      throw createValidationError('item must be an object');
    }

    const priceId = typeof item.priceId === 'string' ? item.priceId.trim() : '';
    if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
      throw createValidationError('invalid or unsupported priceId');
    }

    const quantity = toSafeInt(item.quantity, -1);
    if (quantity < 1 || quantity > 99) {
      throw createValidationError('quantity must be an integer between 1 and 99');
    }

    return { priceId, quantity };
  });
}

function validatePostalCode(postalCode) {
  const value = typeof postalCode === 'string' ? postalCode.trim() : '';
  if (!/^\d{5}$/.test(value)) {
    throw createValidationError('postal_code must be a 5-digit Mexican ZIP code');
  }
  return value;
}

function validateCheckoutPayload(payload) {
  if (!isPlainObject(payload)) {
    throw createValidationError('invalid JSON payload');
  }

  const items = validateItems(payload.items);
  const quoteId = typeof payload.quote_id === 'string' ? payload.quote_id.trim() : '';
  const optionId = typeof payload.option_id === 'string' ? payload.option_id.trim() : '';

  if (!quoteId) {
    throw createValidationError('quote_id is required');
  }

  if (!optionId) {
    throw createValidationError('option_id is required');
  }

  return { items, quoteId, optionId };
}

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createQuoteId() {
  return `quote_${crypto.randomUUID()}`;
}

function getSigningSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_SECRET_KEY || 'local-dev-signing-secret';
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

function encodeSnapshot(snapshot) {
  const json = JSON.stringify(snapshot);
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function decodeSnapshot(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) {
    return null;
  }

  const expected = signPayload(encoded);
  if (signature !== expected) {
    return null;
  }

  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function storeQuoteSnapshot(snapshot) {
  const quoteId = createQuoteId();
  const expiresAt = Date.now() + QUOTE_TTL_MS;
  const normalized = { ...snapshot, quote_id: quoteId, expires_at: expiresAt };
  quoteStore.set(quoteId, normalized);
  return { quoteId, signedQuote: encodeSnapshot(normalized), expiresAt };
}

function getQuoteSnapshot(quoteId) {
  const stored = quoteStore.get(quoteId);
  if (stored && stored.expires_at > Date.now()) {
    return stored;
  }
  if (stored) {
    quoteStore.delete(quoteId);
  }
  const decoded = decodeSnapshot(quoteId);
  if (decoded && decoded.expires_at > Date.now()) {
    return decoded;
  }
  return null;
}

function pruneQuoteStore() {
  const now = Date.now();
  for (const [id, snapshot] of quoteStore.entries()) {
    if (!snapshot || snapshot.expires_at <= now) {
      quoteStore.delete(id);
    }
  }
}

setInterval(pruneQuoteStore, 60 * 1000).unref();

module.exports = {
  validateItems,
  validatePostalCode,
  validateCheckoutPayload,
  createValidationError,
  storeQuoteSnapshot,
  getQuoteSnapshot,
  QUOTE_TTL_MS,
};
