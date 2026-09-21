// Vercel serverless function.
// Deployed URL: https://<your-project>.vercel.app/api/stripe-webhook
//
// This is the automation Enio asked for: the moment a real customer pays on
// Stripe, this function fires automatically and places the matching order
// with Printful (right design, right size, right address) with NO manual
// step in between.
//
// Requires two NEW environment variables in Vercel (Settings > Environment
// Variables), in addition to the existing STRIPE_SECRET_KEY:
//   STRIPE_WEBHOOK_SECRET  - starts with "whsec_", shown once when you
//                            create the webhook endpoint in the Stripe
//                            Dashboard (Developers > Webhooks).
//   PRINTFUL_API_KEY       - from Printful (Settings > Stores > your store
//                            > API, or Settings > API depending on account
//                            type).
//
// IMPORTANT — this does NOT work end-to-end until Printful has a working
// payment method on file (Printful Wallet is currently $0 and there is no
// saved card). Stripe charging the customer and Printful charging Enio are
// two completely separate transactions; this webhook only triggers the
// second one. If Printful has nothing to charge, order creation below will
// fail even though the customer's payment went through fine on Stripe's
// side — Printful's dashboard (Orders) will then show nothing, or an order
// stuck failed, and it will need to be placed manually, the same way the
// last one was.

const crypto = require('crypto');
const Stripe = require('stripe');
const { PRINTFUL_VARIANTS } = require('./printful-mapping');

// Vercel: this route needs the RAW request body to verify the Stripe
// signature, so the automatic JSON body parser must be turned off.
module.exports.config = {
      api: {
              bodyParser: false
      }
};

function readRawBody(req) {
      return new Promise(function (resolve, reject) {
              const chunks = [];
              req.on('data', function (chunk) { chunks.push(chunk); });
              req.on('end', function () { resolve(Buffer.concat(chunks)); });
              req.on('error', reject);
      });
}

module.exports = async function handler(req, res) {
      if (req.method !== 'POST') {
              res.status(405).send('Method not allowed');
              return;
      }

      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
              console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
              res.status(500).send('Server is not configured yet.');
              return;
      }

      const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
      const sig = req.headers['stripe-signature'];
      let event;

      try {
              const rawBody = await readRawBody(req);
              event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
              // Signature didn't match -- this request did NOT genuinely come from
              // Stripe. Reject it rather than trusting it.
              console.error('Webhook signature verification failed:', err.message);
              res.status(400).send('Webhook Error: ' + err.message);
              return;
      }

      // Always acknowledge quickly once we accept the event, so Stripe doesn't
      // keep retrying -- but only AFTER we've done (or safely failed) the work
      // below, so a crash still shows up as a retry instead of being silently
      // swallowed.
      try {
              if (event.type === 'checkout.session.completed') {
                        const session = event.data.object;

                        if (session.payment_status !== 'paid') {
                                    // e.g. a delayed payment method that hasn't settled yet -- Stripe
                                    // will send checkout.session.async_payment_succeeded later, which
                                    // we ignore for now (rare for cards, which is ~all real traffic
                                    // here).
                                    res.status(200).send('ok (not yet paid)');
                                    return;
                        }

                        await placePrintfulOrder(stripe, session);
              }

              res.status(200).send('ok');
      } catch (err) {
              console.error('Webhook handling error for event ' + event.id + ':', err);
              // Non-2xx makes Stripe retry this same event later (Printful order
              // creation below is de-duplicated with external_id, so a retry is
              // safe rather than creating a second order).
              res.status(500).send('Internal error');
      }
};

async function placePrintfulOrder(stripe, session) {
      if (!process.env.PRINTFUL_API_KEY) {
              console.error(
                        'PRINTFUL_API_KEY is not set -- cannot auto-create the Printful order for session ' +
                          session.id +
                          '. This order needs to be placed manually in Printful.'
                      );
              return;
      }

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
              expand: ['data.price.product'],
              limit: 100
      });

      const items = [];
      const problems = [];

      for (const li of lineItems.data) {
              const meta = li.price && li.price.product && li.price.product.metadata;
              const design = meta && meta.design;
              const size = meta && meta.size;

              if (!design || !size) {
                        problems.push('Line item "' + (li.description || li.id) + '" has no design/size metadata.');
                        continue;
              }

              const sizes = PRINTFUL_VARIANTS[design];
              const syncVariantId = sizes && sizes[size];

              if (!syncVariantId) {
                        problems.push('No Printful variant mapping for "' + design + '" size ' + size + '.');
                        continue;
              }

              items.push({
                        sync_variant_id: syncVariantId,
                        quantity: li.quantity
              });
      }

      if (problems.length > 0) {
              console.error(
                        'Session ' + session.id + ' could not be fully mapped to Printful variants: ' + problems.join(' | ')
                      );
      }

      if (items.length === 0) {
              console.error('Session ' + session.id + ' produced zero valid Printful line items -- nothing to order.');
              return;
      }

      // Stripe moved Checkout Session shipping data around over time:
      //   newest API versions -> session.collected_information.shipping_details
      //   older API versions  -> session.shipping_details
      //   legacy               -> session.shipping
      // Check all three so this keeps working across API version changes.
      const shipping =
              (session.collected_information && session.collected_information.shipping_details) ||
              session.shipping_details ||
              session.shipping ||
      {};
      const address = shipping.address || {};
      const customer = session.customer_details || {};

      const recipient = {
              name: shipping.name || customer.name || 'Customer',
              address1: address.line1 || '',
              address2: address.line2 || '',
              city: address.city || '',
              state_code: address.state || '',
              country_code: address.country || '',
              zip: address.postal_code || '',
              phone: customer.phone || '',
              email: customer.email || ''
      };

      const orderPayload = {
              // Ties this Printful order back to the Stripe Checkout Session so a
              // retried webhook delivery (or a manual re-run) can't create a
              // duplicate order for the same payment. Printful's external_id is
              // limited to 32 characters, but a real Stripe session id (e.g.
              // "cs_live_...") is much longer than that and gets rejected with
              // "Invalid External ID specified" -- so we hash it down to a
              // deterministic 32-char hex string instead (same session -> same
              // hash every time, so retries still dedupe correctly).
              external_id: crypto.createHash('sha256').update(session.id).digest('hex').slice(0, 32),
              recipient: recipient,
              items: items,
              // true = submit straight to production and charge Printful's on-file
              // payment method automatically (this is the "full automation" Enio
              // asked for). If Printful billing isn't set up, this call will fail
              // and the order will need to be placed by hand, same as before.
              confirm: true
      };

      const resp = await fetch('https://api.printful.com/orders', {
              method: 'POST',
              headers: {
                        Authorization: 'Bearer ' + process.env.PRINTFUL_API_KEY,
                        'Content-Type': 'application/json'
              },
              body: JSON.stringify(orderPayload)
      });

      const data = await resp.json().catch(function () { return null; });

      if (!resp.ok) {
              console.error(
                        'Printful order creation failed for session ' + session.id + ' (HTTP ' + resp.status + '):',
                        data
                      );
              throw new Error('Printful order creation failed: ' + (data && data.error && data.error.message));
      }

      console.log('Printful order created for session ' + session.id + ':', data && data.result && data.result.id);
}
