// Maps "<Design Name>" + size -> Printful sync_variant_id.
// This is what api/stripe-webhook.js uses to tell Printful exactly which
// blank + size to print and ship after a Stripe payment succeeds.
//
// Collected from Stripe Price nicknames (Product catalogue -> each design's
// product page -> Pricing table) on 21 Sept 2026, cross-checked against the
// Printful "My products" variant pages.
//
// NOTE on "Bull Terrier — Echo's Set": this design was added to Printful on
// 6 Sept 2026, after Printful rolled out a new ID format for new products.
// Its variant IDs look like "6a9d189c42abd3" (confirmed to match exactly what
// Printful's own dashboard shows for each size), while all 7 older designs
// use the older plain-number sync_variant_id format (e.g. 5459945504). It is
// NOT yet confirmed that Printful's Orders API accepts this newer ID format
// the same way -- this needs a live test once the Printful API key is
// available. Until confirmed, orders for this one design may fail to
// auto-fulfill (the webhook will catch that and it will need manual
// handling in Printful for Bull Terrier orders specifically).

module.exports.PRINTFUL_VARIANTS = {
  "Frenchie — Fiona's Ride": {
    XS: 5459945500,
    S: 5459945501,
    M: 5459945502,
    L: 5459945503,
    XL: 5459945504,
    "2XL": 5459945505
  },
  "Golden Retriever — Ansel's Shot": {
    XS: 5463097324,
    S: 5463097325,
    M: 5463097326,
    L: 5463097327,
    XL: 5463097328,
    "2XL": 5463097329
  },
  "Cane Corso — Tank's Day Off": {
    XS: 5463154107,
    S: 5463154108,
    M: 5463154109,
    L: 5463154110,
    XL: 5463154111,
    "2XL": 5463154112
  },
  "Chihuahua — Frosty's Forecast": {
    XS: 5463179437,
    S: 5463179438,
    M: 5463179439,
    L: 5463179440,
    XL: 5463179441,
    "2XL": 5463179442
  },
  "Basset Hound — Eddie's Jump": {
    XS: 5468410354,
    S: 5468410355,
    M: 5468410356,
    L: 5468410357,
    XL: 5468410358,
    "2XL": 5468410359
  },
  "Pug — Puff's Gift": {
    XS: 5468496802,
    S: 5468496803,
    M: 5468496804,
    L: 5468496805,
    XL: 5468496806,
    "2XL": 5468496807
  },
  "English Bulldog — Gordon's Menu": {
    XS: 5468464633,
    S: 5468464634,
    M: 5468464635,
    L: 5468464636,
    XL: 5468464637,
    "2XL": 5468464638
  },
  // See NOTE above -- newer ID format, needs a live API test to confirm.
  "Bull Terrier — Echo's Set": {
    XS: "6a9d189c42abd3",
    S: "6a9d189c42ac02",
    M: "6a9d189c42ac15",
    L: "6a9d189c42ac23",
    XL: "6a9d189c42ac47",
    "2XL": "6a9d189c42ac52"
  }
};
