const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const ALLOWED_PRICES = new Set([
  "price_catuai_250g",
  "price_catuai_500g",
  "price_catuai_1kg",
  "price_zongolica_250g",
  "price_zongolica_500g",
  "price_zongolica_1kg",
  "price_cosautlan_250g",
  "price_cosautlan_500g",
  "price_cosautlan_1kg",
  "price_corahe_250g",
  "price_corahe_500g",
  "price_corahe_1kg",
]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "No items provided" });
      return;
    }

    const lineItems = items.map((item) => {
      const priceId = item?.priceId;
      const quantity = Number(item?.quantity || 1);

      if (!ALLOWED_PRICES.has(priceId)) {
        throw new Error("Invalid price id");
      }

      return {
        price: priceId,
        quantity: Math.max(1, Math.min(quantity, 99)),
      };
    });

    const metadataItems = items.map((item) => ({
      productId: item.productId || null,
      name: item.name || null,
      size: item.size || null,
      grind: item.grind || null,
      qty: Number(item.quantity || 1),
      priceId: item.priceId || null,
    }));

    const metadata = {
      items: JSON.stringify(metadataItems).slice(0, 500),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      metadata,
      success_url: `${process.env.PUBLIC_BASE_URL}/success.html`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message || "Checkout error" });
  }
};
