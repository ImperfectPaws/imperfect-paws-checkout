// Shared design -> size -> Stripe Price ID lookup table.
// This same data lives in two places on purpose (no shared build step between
// the static site and the Vercel function):
//   1) public_html/cart.js        (this file, used by the BROWSER for display only)
//   2) api/create-checkout-session.js (server copy, used to build the real charge)
// The server copy is the one that actually determines what the customer is charged.
// If you ever add/remove a design or size, update BOTH files.

window.IP_DESIGNS = {
  "Frenchie — Fiona's Ride": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "Golden Retriever — Ansel's Shot": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "Cane Corso — Tank's Day Off": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "Chihuahua — Frosty's Forecast": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "Basset Hound — Eddie's Jump": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "Pug — Puff's Gift": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "English Bulldog — Gordon's Menu": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  },
  "Bull Terrier — Echo's Set": {
    prices: { XS: 3999, S: 3999, M: 3999, L: 3999, XL: 3999, "2XL": 3999 }
  }
};

// Flat shipping charge shown in the drawer (must match the Stripe shipping
// rate the server attaches: shr_1UG2vEPzOG8dmuRgjuU3wBDs / $6.99).
window.IP_SHIPPING_CENTS = 699;
