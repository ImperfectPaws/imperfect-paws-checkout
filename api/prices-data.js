// Server-side source of truth for design -> size -> Stripe Price ID.
// This is what actually determines what a customer is charged — keep it in
// sync with the Stripe product catalogue (Product catalogue > All products).
// Collected & independently verified from the Stripe Dashboard on 15 Sept 2026.

module.exports.DESIGNS = {
  "Frenchie — Fiona's Ride": {
    product_id: "prod_V8PHUHDMnWFCAO",
    prices: {
      XS: "price_1U9wMyPzOG8dmuRg2t4Myju1",
      S: "price_1UA2V9PzOG8dmuRgtsa5ga6D",
      M: "price_1UA2XePzOG8dmuRgy4Zvbrit",
      L: "price_1UA2aoPzOG8dmuRgFc7dMEPL",
      XL: "price_1UAG7IPzOG8dmuRgzIQTzVK6",
      "2XL": "price_1UAG7IPzOG8dmuRgbOpqMYvP"
    }
  },
  "Golden Retriever — Ansel's Shot": {
    product_id: "prod_V8PIIbImEF0txu",
    prices: {
      XS: "price_1U9w8BPzOG8dmuRg59QorOKa",
      S: "price_1U9w9IPzOG8dmuRgeI2RN17H",
      M: "price_1U9wBgPzOG8dmuRgGsbnaM45",
      L: "price_1U9wEWPzOG8dmuRgeZSKbQl4",
      XL: "price_1U9wHEPzOG8dmuRgCcA1Fb1s",
      "2XL": "price_1U9wKYPzOG8dmuRgEOAQf1zg"
    }
  },
  "Cane Corso — Tank's Day Off": {
    product_id: "prod_V8PNgBVhSWUfhJ",
    prices: {
      XS: "price_1U9vzlPzOG8dmuRgdG1h4z70",
      S: "price_1U9w0OPzOG8dmuRgCdL2kx8Q",
      M: "price_1U9w1APzOG8dmuRgEFE6oChx",
      L: "price_1U9w2SPzOG8dmuRgweaMhRY8",
      XL: "price_1U9w3YPzOG8dmuRguOUDyMML",
      "2XL": "price_1U9w6MPzOG8dmuRgeNYdgpSj"
    }
  },
  "Chihuahua — Frosty's Forecast": {
    product_id: "prod_V8PMO7w7BEfpmq",
    prices: {
      XS: "price_1U9vjcPzOG8dmuRga9R4J0Im",
      S: "price_1U9vu3PzOG8dmuRgpd8rhtN9",
      M: "price_1U9vwPPzOG8dmuRg90tx8VtM",
      L: "price_1U9vxMPzOG8dmuRgv1fUtLVz",
      XL: "price_1U9vxtPzOG8dmuRgCohSodA7",
      "2XL": "price_1U9vyOPzOG8dmuRg0bnjLCLC"
    }
  },
  "Basset Hound — Eddie's Jump": {
    product_id: "prod_V8PP5it9hgwzDk",
    prices: {
      XS: "price_1UAG7OPzOG8dmuRgSZxlbBXo",
      S: "price_1UAG7OPzOG8dmuRgFnGk5ZtQ",
      M: "price_1UAG7PPzOG8dmuRgnUg4OSyP",
      L: "price_1UAG7PPzOG8dmuRg1ZzFD3Vi",
      XL: "price_1UAG7QPzOG8dmuRgEmHo9gbx",
      "2XL": "price_1UAG7QPzOG8dmuRgQXO4Scq1"
    }
  },
  "Pug — Puff's Gift": {
    product_id: "prod_V8PKh8waktC0SW",
    prices: {
      XS: "price_1UAG7JPzOG8dmuRgH2Wq04qS",
      S: "price_1UAG7JPzOG8dmuRgGeucTCoL",
      M: "price_1UAG7KPzOG8dmuRgJBFXkcmM",
      L: "price_1UAG7KPzOG8dmuRgRERPgmM2",
      XL: "price_1UAG7KPzOG8dmuRguJuhQQhK",
      "2XL": "price_1UAG7LPzOG8dmuRgQO9k55Yu"
    }
  },
  "English Bulldog — Gordon's Menu": {
    product_id: "prod_V8PLtg7v17C3Zd",
    prices: {
      XS: "price_1UAG7LPzOG8dmuRgRpRgZIjD",
      S: "price_1UAG7MPzOG8dmuRgEuGOPKXh",
      M: "price_1UAG7MPzOG8dmuRgD19v0R5m",
      L: "price_1UAG7NPzOG8dmuRgDLq3RqqP",
      XL: "price_1UAG7NPzOG8dmuRgX4t1AbWO",
      "2XL": "price_1UAG7OPzOG8dmuRgpjKdunPU"
    }
  },
  "Bull Terrier — Echo's Set": {
    product_id: "prod_VD0qJVcsQW4g8x",
    prices: {
      XS: "price_1UCbHsPzOG8dmuRgBqJtHFSW",
      S: "price_1UCbJJPzOG8dmuRgnhpN2Gml",
      M: "price_1UCbKqPzOG8dmuRgDKk3gnv2",
      L: "price_1UCbOrPzOG8dmuRgi4w6qyNj",
      XL: "price_1UCbSrPzOG8dmuRgiC1UG2DX",
      "2XL": "price_1UCbXuPzOG8dmuRg6qXy9Fvx"
    }
  }
};

module.exports.SHIPPING_RATE_ID = "shr_1UG2vEPzOG8dmuRgjuU3wBDs";
