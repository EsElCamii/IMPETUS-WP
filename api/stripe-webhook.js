const Stripe = require('stripe');
const { createShipment } = require('./lib/skydropx');
const { insertOrder, findOrderBySessionId } = require('./lib/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function parseItems(metadataItems) {
  if (!metadataItems) {
    return null;
  }
  try {
    return JSON.parse(metadataItems);
  } catch (error) {
    return metadataItems;
  }
}

function buildRecipientFromSession(session) {
  const details = session.customer_details || {};
  const address = details.address || {};

  return {
    name: details.name || session.customer_email || 'Cliente IMPETUS',
    company: '',
    phone: details.phone || '0000000000',
    email: details.email || session.customer_email || null,
    country_code: address.country || 'MX',
    postal_code: address.postal_code || null,
    state: address.state || null,
    city: address.city || null,
    street: address.line1 || null,
    number: 'SN',
    interior: address.line2 || null,
    reference: 'Checkout Stripe',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).send('Missing Stripe signature');
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    if (event.type !== 'checkout.session.completed') {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const session = event.data.object;

    if (session.payment_status !== 'paid') {
      res.status(200).json({ received: true, ignored: 'payment_not_paid' });
      return;
    }

    const alreadySaved = await findOrderBySessionId(session.id);
    if (alreadySaved) {
      res.status(200).json({ received: true, idempotent: true });
      return;
    }

    const metadata = session.metadata || {};
    const orderBase = {
      stripe_session_id: session.id,
      customer_email: session.customer_details?.email || null,
      amount_total: session.amount_total,
      currency: session.currency,
      status: 'paid',
      shipping_provider: metadata.shipping_provider || null,
      shipping_price: metadata.shipping_price ? Number(metadata.shipping_price) : null,
      items: parseItems(metadata.items),
      created_at: new Date().toISOString(),
    };

    try {
      const shipmentPayload = {
        quotation_id: metadata.quotation_id,
        recipient: buildRecipientFromSession(session),
      };

      if (!shipmentPayload.quotation_id || !shipmentPayload.recipient.postal_code) {
        throw new Error('Missing quotation_id or recipient postal code in webhook metadata/session');
      }

      // Stripe webhooks on Vercel are stateless; shipment creation is done synchronously here
      // to keep consistency with documented Skydropx flow while preserving signature validation.
      const shipment = await createShipment(shipmentPayload);

      await insertOrder({
        ...orderBase,
        status: 'shipment_created',
        tracking_number: shipment.tracking_number || shipment.tracking || null,
        label_url: shipment.label_url || shipment.label?.url || null,
        shipment_id: shipment.shipment_id || shipment.id || null,
        error_details: null,
      });
    } catch (shipmentError) {
      console.error('[webhook][shipment_error]', {
        stripe_session_id: session.id,
        message: shipmentError.message,
      });

      await insertOrder({
        ...orderBase,
        status: 'shipment_failed',
        tracking_number: null,
        label_url: null,
        shipment_id: null,
        error_details: shipmentError.message,
      });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook][signature_or_processing_error]', { message: error.message });
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
