const Stripe = require('stripe');
const { validateCheckoutPayload } = require('./lib/validation');
const { getQuoteSnapshot } = require('./lib/validation');
const { getCatalogEntryByPriceId } = require('./lib/catalog');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

function canonicalItems(items) {
  return items
    .map((item) => `${item.priceId}:${item.quantity}`)
    .sort()
    .join('|');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe is not configured');
    }

    const { items, quoteId, optionId } = validateCheckoutPayload(req.body || {});
    const snapshot = getQuoteSnapshot(quoteId) || getQuoteSnapshot(req.body?.quote_token);

    if (!snapshot) {
      res.status(400).json({ error: 'Shipping quote expired or invalid. Request a new quote.' });
      return;
    }

    const matchesSnapshot = canonicalItems(items) === canonicalItems(snapshot.items || []);
    if (!matchesSnapshot) {
      res.status(400).json({ error: 'Cart items do not match the quoted shipment.' });
      return;
    }

    const shippingOption = (snapshot.options || []).find((opt) => opt.option_id === optionId);
    if (!shippingOption) {
      res.status(400).json({ error: 'Selected shipping option is invalid for this quote.' });
      return;
    }

    const productLineItems = items.map((item) => {
      const catalogEntry = getCatalogEntryByPriceId(item.priceId);
      if (!catalogEntry) {
        throw new Error(`Catalog entry not found for priceId: ${item.priceId}`);
      }

      const unitAmountCents = Math.round(Number(catalogEntry.priceMxn) * 100);
      if (!Number.isInteger(unitAmountCents) || unitAmountCents <= 0) {
        throw new Error(`Invalid catalog price for ${item.priceId}`);
      }

      return {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `${catalogEntry.productName} ${catalogEntry.size}`,
          },
          unit_amount: unitAmountCents,
        },
        quantity: item.quantity,
      };
    });

    const shippingAmountCents = Math.round(Number(shippingOption.price_mxn) * 100);
    if (!Number.isInteger(shippingAmountCents) || shippingAmountCents < 0) {
      throw new Error('Invalid shipping amount');
    }

    const lineItems = [
      ...productLineItems,
      {
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Envío ${shippingOption.provider} - ${shippingOption.service}`,
          },
          unit_amount: shippingAmountCents,
        },
        quantity: 1,
      },
    ];

    const metadata = {
      quote_id: String(snapshot.quote_id || quoteId).slice(0, 500),
      quotation_id: String(shippingOption.quotation_id).slice(0, 500),
      shipping_provider: String(shippingOption.provider).slice(0, 500),
      shipping_service: String(shippingOption.service).slice(0, 500),
      shipping_price: String(shippingOption.price_mxn),
      destination_postal_code: String(snapshot.postal_code || '').slice(0, 500),
      items: JSON.stringify(items).slice(0, 500),
    };

    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (!publicBaseUrl) {
      throw new Error('PUBLIC_BASE_URL is required');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      shipping_address_collection: {
        allowed_countries: ['MX'],
      },
      metadata,
      success_url: `${publicBaseUrl}/success.html`,
      cancel_url: `${publicBaseUrl}/cancel.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Checkout session could not be created' : error.message;
    res.status(statusCode).json({ error: message });
  }
};
