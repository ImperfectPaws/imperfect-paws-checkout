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
// Printful billing (Settings > Billing > Billing methods) needs a working
// card on file for this to actually charge through -- that part is already
// set up. One thing that's outside this code's control: some bank cards
// require a one-time 3D Secure / "approve in your banking app" step on a
// charge, which Printful cannot complete headlessly from an API call. When
// that happens, Printful leaves the order as an unconfirmed draft and it
// shows up under Orders > "Approve orders" in the Printful dashboard,
// needing one manual click (and the bank's approval) to finish. That is a
// bank security feature, not a bug here.

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

        if (!address.line1 || !address.city || !address.country) {
                  // Without a real street address there is nothing Printful can ship to.
                  // This has happened once before (an old checkout session that never
                  // collected shipping details) and left a payment with no way to ever
                  // be fulfilled -- log loudly instead of sending Printful a doomed
                  // request, so this gets noticed and refunded/fixed by hand instead of
                  // silently vanishing.
                  console.error(
                              'Session ' + session.id + ' has no usable shipping address (line1/city/country missing) -- ' +
                                'refusing to create a Printful order that can never be shipped. This needs manual follow-up ' +
                                '(check whether the Checkout Session actually collected a shipping address).'
                            );
                  return;
        }

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
                  // A duplicate external_id (HTTP 400, "not unique") means Stripe retried
                  // a webhook delivery whose order we already successfully created earlier
                  // -- that's expected and fine, not a real failure, so don't throw (which
                  // would just make Stripe retry forever).
                  const alreadyExists =
                              resp.status === 400 &&
                              data &&
                              data.error &&
                              typeof data.error.message === 'string' &&
                              /external.?id/i.test(data.error.message) &&
                              /(exist|unique|duplicate)/i.test(data.error.message);

                  if (alreadyExists) {
                              console.log(
                                            'Printful order for session ' + session.id + ' already exists (duplicate webhook delivery) -- nothing more to do.'
                                          );
                              return;
                  }

                  console.error(
                              'Printful order creation failed for session ' + session.id + ' (HTTP ' + resp.status + '):',
                              data
                            );
                  throw new Error('Printful order creation failed: ' + (data && data.error && data.error.message));
        }

        const orderId = data && data.result && data.result.id;
        const status = data && data.result && data.result.status;

        console.log('Printful order created for session ' + session.id + ':', orderId, '(status: ' + status + ')');

        // Printful sometimes can't finish cost calculation synchronously (e.g. an
        // EU order needing a VAT calculation) and falls back to "draft" even
        // though we asked for confirm:true -- in that case a separate explicit
        // confirm call is required. Try it a couple of times with a short pause;
        // if the card also needs a one-time 3D Secure approval, this will keep
        // failing and the order will need the one manual click in Printful's
        // "Approve orders" screen -- that's a bank security step, not something
        // any code can skip.
        if (status === 'draft' && orderId) {
                  await confirmPrintfulOrderWithRetry(orderId, session.id);
        }
}

async function confirmPrintfulOrderWithRetry(orderId, sessionId) {
        const delaysMs = [1500, 3000];

        for (let attempt = 0; attempt < delaysMs.length; attempt++) {
                  await new Promise(function (resolve) { setTimeout(resolve, delaysMs[attempt]); });

                  const resp = await fetch('https://api.printful.com/orders/' + orderId + '/confirm', {
                              method: 'POST',
                              headers: { Authorization: 'Bearer ' + process.env.PRINTFUL_API_KEY }
                  });
                  const data = await resp.json().catch(function () { return null; });

                  if (resp.ok) {
                              console.log(
                                            'Printful order ' + orderId + ' (session ' + sessionId + ') auto-confirmed after briefly being in draft.'
                                          );
                              return;
                  }

                  console.error(
                              'Attempt ' + (attempt + 1) + ' to auto-confirm Printful order ' + orderId + ' (session ' + sessionId +
                                ') failed (HTTP ' + resp.status + '):',
                              data
                            );
        }

        console.error(
                  'Printful order ' + orderId + ' (session ' + sessionId + ') is still in draft status after auto-confirm ' +
                    'attempts -- it needs one manual click in Printful (Orders > Approve orders). This usually means the ' +
                    'card on file needed a 3D Secure approval that only a real checkout page can trigger.'
                );
}

