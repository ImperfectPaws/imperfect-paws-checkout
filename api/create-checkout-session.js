// Vercel serverless function.
// Deployed URL will look like: https://<your-project>.vercel.app/api/create-checkout-session
//
// Receives the customer's cart from the browser, resolves every line to a
// real Stripe Price ID (never trusting a price the browser sends), and
// creates ONE Checkout Session with all items + a single shipping charge.
// This is what fixes the "family orders 4 shirts, pays shipping 4 times"
// problem: everything in the cart becomes one Stripe order.
//
// Requires an environment variable STRIPE_SECRET_KEY, set in the Vercel
// project settings (Settings > Environment Variables). Never commit the
// actual secret key into this file or into git.

const Stripe = require('stripe');
const { DESIGNS, SHIPPING_RATE_ID } = require('./prices-data');

const ALLOWED_ORIGINS = [
  'https://www.imperfectpaws.com',
  'https://imperfectpaws.com'
];

const MAX_QTY_PER_LINE = 10;
const MAX_LINE_ITEMS = 20;

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    res.status(500).json({ error: 'Server is not configured yet.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const items = body && Array.isArray(body.items) ? body.items : null;

  if (!items || items.length === 0) {
    res.status(400).json({ error: 'Cart is empty.' });
    return;
  }
  if (items.length > MAX_LINE_ITEMS) {
    res.status(400).json({ error: 'Too many different items in one order.' });
    return;
  }

  const pendingLineItems = [];
  for (const raw of items) {
    const design = raw && DESIGNS[raw.design];
    if (!design) {
      res.status(400).json({ error: 'Unknown item in cart: ' + (raw && raw.design) });
      return;
    }
    const priceId = design.prices[raw.size];
    if (!priceId) {
      res.status(400).json({ error: 'Unknown size "' + raw.size + '" for ' + raw.design });
      return;
    }
    let qty = parseInt(raw.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    qty = Math.min(MAX_QTY_PER_LINE, qty);

    pendingLineItems.push({ priceId: priceId, quantity: qty, design: raw.design, size: raw.size });
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const siteOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  try {
    // Re-price every line from our own stored Stripe Price (never the size
    // the browser sent), then rebuild it as an inline price_data with the
    // SIZE folded into the product name. Referencing the pre-made `price`
    // directly (the old approach) shows only the shared product name in the
    // Dashboard and on receipts -- e.g. "Fiona's Ride" -- with no way to
    // tell an XS order from a 2XL order after the fact. That is what caused
    // an order to ship in the wrong size, so don't revert this.
    const line_items = await Promise.all(pendingLineItems.map(async function (li) {
      const price = await stripe.prices.retrieve(li.priceId);
      return {
        price_data: {
          currency: price.currency,
          unit_amount: price.unit_amount,
          product_data: {
            name: li.design + ' — Size ' + li.size
          }
        },
        quantity: li.quantity
      };
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      // Without this, Stripe never asks the customer for a shipping
      // address -- we only ever get their billing country. Add/remove
      // country codes here as you expand where you're willing to ship.
      shipping_address_collection: {
        allowed_countries: [
          'SI', 'AT', 'DE', 'IT', 'HR', 'HU', 'FR', 'ES', 'PT', 'NL', 'BE',
          'LU', 'IE', 'PL', 'CZ', 'SK', 'SE', 'DK', 'FI', 'NO', 'CH', 'GB',
          'US', 'CA', 'AU', 'NZ'
        ]
      },
      phone_number_collection: { enabled: true },
      shipping_options: [{ shipping_rate: SHIPPING_RATE_ID }],
      success_url: siteOrigin + '/?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: siteOrigin + '/?checkout=cancelled'
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
