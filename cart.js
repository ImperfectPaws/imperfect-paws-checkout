/*
 * IMPERFECT PAWS — shopping cart (side drawer) + checkout
 * ---------------------------------------------------------
 * WHAT THIS REPLACES: previously every "Add to Cart" button linked straight
 * to an individual Stripe Payment Link, so a customer buying more than one
 * shirt had to place a separate order (and pay shipping) for each one.
 *
 * WHAT THIS DOES INSTEAD: keeps a cart in localStorage, shows it in a side
 * drawer, and on "Checkout" sends the cart contents to a small serverless
 * function (see api/create-checkout-session.js) which creates ONE Stripe
 * Checkout Session with all the line items and a single shipping charge.
 *
 * SETUP NEEDED BEFORE THIS WORKS:
 *   1. Deploy the api/create-checkout-session.js function (see DEPLOY.md).
 *   2. Paste its URL into CHECKOUT_ENDPOINT below.
 *   3. Include cart-data.js BEFORE this file, and this file before </body>.
 *   4. Remove the old inline <script> block in index.html that set
 *      `btn.href = links[size]` on the buy-btn (see INTEGRATION.md) — this
 *      file replaces that behavior.
 */
(function () {
  'use strict';

  // ---- 1. CONFIG -----------------------------------------------------
  var CHECKOUT_ENDPOINT = 'https://imperfect-paws-checkout.vercel.app/api/create-checkout-session';
  var CART_KEY = 'ip_cart_v1';
  var MAX_QTY_PER_LINE = 10;

  // ---- 2. CART STATE ---------------------------------------------------
  function readCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (e) {
      /* localStorage unavailable (private mode etc.) — cart just won't persist */
    }
    render();
  }

  function addItem(design, size, name, image, unitCents) {
    var items = readCart();
    var existing = items.find(function (it) { return it.design === design && it.size === size; });
    if (existing) {
      existing.qty = Math.min(MAX_QTY_PER_LINE, existing.qty + 1);
    } else {
      items.push({ design: design, size: size, name: name, image: image, unitCents: unitCents, qty: 1 });
    }
    writeCart(items);
    openDrawer();
  }

  function setQty(index, qty) {
    var items = readCart();
    if (!items[index]) return;
    qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, qty | 0));
    items[index].qty = qty;
    writeCart(items);
  }

  function removeItem(index) {
    var items = readCart();
    items.splice(index, 1);
    writeCart(items);
  }

  function cartCount(items) {
    return items.reduce(function (sum, it) { return sum + it.qty; }, 0);
  }

  function cartSubtotalCents(items) {
    return items.reduce(function (sum, it) { return sum + it.unitCents * it.qty; }, 0);
  }

  function money(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // ---- 3. DRAWER UI (built once, injected into the page) ---------------
  var els = {};

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#ip-cart-fab{position:fixed;right:20px;bottom:20px;z-index:9998;',
      'width:56px;height:56px;border-radius:999px;border:none;cursor:pointer;',
      'background:#a5391f;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.25);',
      'display:flex;align-items:center;justify-content:center;font-size:22px;',
      'transition:transform .15s ease;}',
      '#ip-cart-fab:hover{transform:scale(1.06);}',
      '#ip-cart-fab .ip-cart-badge{position:absolute;top:-4px;right:-4px;',
      'background:#1f1f1f;color:#fff;border-radius:999px;min-width:20px;height:20px;',
      'font-size:11px;line-height:20px;text-align:center;padding:0 5px;',
      'font-family:inherit;box-shadow:0 0 0 2px #fff;}',
      '#ip-cart-overlay{position:fixed;inset:0;background:rgba(20,15,10,.45);',
      'opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:9999;}',
      '#ip-cart-overlay.ip-open{opacity:1;pointer-events:auto;}',
      '#ip-cart-drawer{position:fixed;top:0;right:0;height:100%;width:380px;',
      'max-width:92vw;background:#fffaf4;box-shadow:-8px 0 24px rgba(0,0,0,.18);',
      'transform:translateX(100%);transition:transform .25s ease;z-index:10000;',
      'display:flex;flex-direction:column;font-family:inherit;}',
      '#ip-cart-drawer.ip-open{transform:translateX(0);}',
      '.ip-cart-head{display:flex;align-items:center;justify-content:space-between;',
      'padding:18px 20px;border-bottom:1px solid #ecdfd0;}',
      '.ip-cart-head h2{margin:0;font-size:1.1rem;}',
      '.ip-cart-close{background:none;border:none;font-size:22px;cursor:pointer;',
      'line-height:1;color:#6b5b4a;padding:4px;}',
      '.ip-cart-items{flex:1;overflow-y:auto;padding:12px 20px;}',
      '.ip-cart-empty{color:#8a7a68;padding:40px 0;text-align:center;font-size:.95rem;}',
      '.ip-cart-row{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #f1e6d8;}',
      '.ip-cart-row img{width:56px;height:56px;object-fit:cover;border-radius:8px;',
      'background:#eee;flex-shrink:0;}',
      '.ip-cart-row-body{flex:1;min-width:0;}',
      '.ip-cart-row-title{font-size:.88rem;font-weight:600;margin:0 0 2px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ip-cart-row-size{font-size:.8rem;color:#8a7a68;margin:0 0 8px;}',
      '.ip-cart-row-controls{display:flex;align-items:center;gap:10px;}',
      '.ip-qty-btn{width:24px;height:24px;border:1px solid #ddcbb8;background:#fff;',
      'border-radius:6px;cursor:pointer;font-size:14px;line-height:1;color:#3a2f24;}',
      '.ip-qty-val{min-width:18px;text-align:center;font-size:.85rem;',
      'font-variant-numeric:tabular-nums;}',
      '.ip-cart-row-price{font-size:.85rem;color:#3a2f24;margin-left:auto;}',
      '.ip-cart-remove{background:none;border:none;color:#a5391f;font-size:.78rem;',
      'cursor:pointer;padding:0;margin-left:10px;text-decoration:underline;}',
      '.ip-cart-foot{border-top:1px solid #ecdfd0;padding:16px 20px 20px;}',
      '.ip-cart-line{display:flex;justify-content:space-between;font-size:.88rem;',
      'color:#6b5b4a;margin-bottom:6px;}',
      '.ip-cart-line.ip-total{font-size:1rem;font-weight:700;color:#1f1f1f;',
      'margin-top:8px;}',
      '.ip-cart-checkout{width:100%;margin-top:14px;padding:13px;border:none;',
      'border-radius:10px;background:#a5391f;color:#fff;font-size:.95rem;',
      'font-weight:600;cursor:pointer;}',
      '.ip-cart-checkout:disabled{opacity:.6;cursor:default;}',
      '.ip-cart-error{color:#a5391f;font-size:.82rem;margin-top:10px;display:none;}'
    ].join('');
    document.head.appendChild(style);
  }

  function buildDrawer() {
    var fab = document.createElement('button');
    fab.id = 'ip-cart-fab';
    fab.setAttribute('aria-label', 'Open cart');
    fab.innerHTML = '🛍️<span class="ip-cart-badge" id="ip-cart-badge" hidden>0</span>';
    fab.addEventListener('click', openDrawer);

    var overlay = document.createElement('div');
    overlay.id = 'ip-cart-overlay';
    overlay.addEventListener('click', closeDrawer);

    var drawer = document.createElement('aside');
    drawer.id = 'ip-cart-drawer';
    drawer.setAttribute('aria-label', 'Shopping cart');
    drawer.innerHTML =
      '<div class="ip-cart-head"><h2>Your cart</h2>' +
      '<button class="ip-cart-close" aria-label="Close cart">×</button></div>' +
      '<div class="ip-cart-items" id="ip-cart-items"></div>' +
      '<div class="ip-cart-foot">' +
      '<div class="ip-cart-line"><span>Subtotal</span><span id="ip-cart-subtotal">$0.00</span></div>' +
      '<div class="ip-cart-line"><span>Shipping</span><span id="ip-cart-shipping">$0.00</span></div>' +
      '<div class="ip-cart-line ip-total"><span>Total</span><span id="ip-cart-total">$0.00</span></div>' +
      '<button class="ip-cart-checkout" id="ip-cart-checkout-btn">Checkout</button>' +
      '<div class="ip-cart-error" id="ip-cart-error">Something went wrong — please try again in a moment.</div>' +
      '</div>';
    drawer.querySelector('.ip-cart-close').addEventListener('click', closeDrawer);
    drawer.querySelector('#ip-cart-checkout-btn').addEventListener('click', checkout);

    document.body.appendChild(fab);
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    els.fab = fab;
    els.badge = fab.querySelector('#ip-cart-badge');
    els.overlay = overlay;
    els.drawer = drawer;
    els.itemsBox = drawer.querySelector('#ip-cart-items');
    els.subtotal = drawer.querySelector('#ip-cart-subtotal');
    els.shipping = drawer.querySelector('#ip-cart-shipping');
    els.total = drawer.querySelector('#ip-cart-total');
    els.checkoutBtn = drawer.querySelector('#ip-cart-checkout-btn');
    els.error = drawer.querySelector('#ip-cart-error');
  }

  function openDrawer() {
    els.overlay.classList.add('ip-open');
    els.drawer.classList.add('ip-open');
  }
  function closeDrawer() {
    els.overlay.classList.remove('ip-open');
    els.drawer.classList.remove('ip-open');
  }

  function render() {
    var items = readCart();
    var count = cartCount(items);

    els.badge.textContent = String(count);
    els.badge.hidden = count === 0;

    if (items.length === 0) {
      els.itemsBox.innerHTML = '<p class="ip-cart-empty">Your cart is empty.</p>';
    } else {
      els.itemsBox.innerHTML = '';
      items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'ip-cart-row';
        row.innerHTML =
          '<img src="' + escapeAttr(it.image || '') + '" alt="">' +
          '<div class="ip-cart-row-body">' +
          '<p class="ip-cart-row-title">' + escapeHtml(it.name || it.design) + '</p>' +
          '<p class="ip-cart-row-size">Size ' + escapeHtml(it.size) + '</p>' +
          '<div class="ip-cart-row-controls">' +
          '<button class="ip-qty-btn" data-act="dec">−</button>' +
          '<span class="ip-qty-val">' + it.qty + '</span>' +
          '<button class="ip-qty-btn" data-act="inc">+</button>' +
          '<span class="ip-cart-row-price">' + money(it.unitCents * it.qty) + '</span>' +
          '</div>' +
          '<button class="ip-cart-remove" data-act="remove">Remove</button>' +
          '</div>';
        row.querySelector('[data-act="dec"]').addEventListener('click', function () {
          setQty(i, it.qty - 1 <= 0 ? 1 : it.qty - 1);
          if (it.qty - 1 <= 0) removeItem(i);
        });
        row.querySelector('[data-act="inc"]').addEventListener('click', function () {
          setQty(i, it.qty + 1);
        });
        row.querySelector('[data-act="remove"]').addEventListener('click', function () {
          removeItem(i);
        });
        els.itemsBox.appendChild(row);
      });
    }

    var subtotal = cartSubtotalCents(items);
    var shipping = items.length ? window.IP_SHIPPING_CENTS : 0;
    els.subtotal.textContent = money(subtotal);
    els.shipping.textContent = items.length ? money(shipping) : '—';
    els.total.textContent = money(subtotal + shipping);
    els.checkoutBtn.disabled = items.length === 0;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---- 4. CHECKOUT -------------------------------------------------
  function checkout() {
    var items = readCart();
    if (!items.length) return;
    els.error.style.display = 'none';
    els.checkoutBtn.disabled = true;
    els.checkoutBtn.textContent = 'Redirecting…';

    var payload = {
      items: items.map(function (it) {
        return { design: it.design, size: it.size, quantity: it.qty };
      })
    };

    fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('bad status ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('no url in response');
        }
      })
      .catch(function () {
        els.error.style.display = 'block';
        els.checkoutBtn.disabled = false;
        els.checkoutBtn.textContent = 'Checkout';
      });
  }

  // ---- 5. WIRE UP THE EXISTING PRODUCT CARDS ------------------------
  // Mirrors the old script's size-pill logic, but the "Add to Cart" button
  // now pushes into the cart instead of following a Payment Link href.
  function wireCards() {
    document.querySelectorAll('.card').forEach(function (card) {
      var picker = card.querySelector('.size-picker');
      var btn = card.querySelector('.buy-btn');
      if (!picker || !btn) return;

      var hint = document.createElement('p');
      hint.className = 'size-hint';
      hint.setAttribute('aria-live', 'polite');
      hint.style.cssText = 'font-size:.8rem;color:#a5391f;margin-top:6px;display:none;';
      hint.textContent = 'Please select a size first.';
      picker.insertAdjacentElement('afterend', hint);

      var nameEl = card.querySelector('h3');
      var imgEl = card.querySelector('img');
      var designName = nameEl ? nameEl.textContent.trim() : '';
      var design = window.IP_DESIGNS[designName];
      var pills = picker.querySelectorAll('.size-pill');
      var selectedSize = null;

      pills.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); });

      function select(size) {
        selectedSize = size;
        pills.forEach(function (p) {
          p.setAttribute('aria-pressed', p.dataset.size === size ? 'true' : 'false');
        });
        btn.classList.remove('muted');
      }

      pills.forEach(function (p) {
        p.addEventListener('click', function () { select(p.dataset.size); });
      });

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!selectedSize || btn.classList.contains('muted')) {
          hint.style.display = 'block';
          picker.classList.remove('needs-selection');
          void picker.offsetWidth;
          picker.classList.add('needs-selection');
          return;
        }
        if (!design || !design.prices[selectedSize]) {
          console.error('IP cart: no price data for', designName, selectedSize);
          return;
        }
        addItem(designName, selectedSize, designName, imgEl ? imgEl.getAttribute('src') : '', design.prices[selectedSize]);
      });
    });
  }

  // ---- 6. POST-CHECKOUT HANDLING --------------------------------------
  // Stripe redirects back to success_url / cancel_url from
  // api/create-checkout-session.js. If the customer just paid, the cart
  // they paid for is still sitting in localStorage — clear it and show a
  // quick confirmation so they don't think the payment failed (and don't
  // accidentally pay again). If they cancelled, just clean the URL and
  // leave their cart alone so they can retry.
  function injectBannerStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#ip-order-banner{position:fixed;top:0;left:0;right:0;z-index:10001;',
      'background:#2f6b3a;color:#fff;padding:14px 20px;text-align:center;',
      'font-size:.92rem;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.15);}',
      '#ip-order-banner button{background:none;border:none;color:#fff;',
      'opacity:.85;font-size:1.1rem;cursor:pointer;position:absolute;right:16px;',
      'top:50%;transform:translateY(-50%);line-height:1;}'
    ].join('');
    document.head.appendChild(style);
  }

  function showOrderBanner(text) {
    injectBannerStyles();
    var banner = document.createElement('div');
    banner.id = 'ip-order-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = escapeHtml(text) + '<button aria-label="Dismiss">×</button>';
    banner.querySelector('button').addEventListener('click', function () {
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  function handleCheckoutReturn() {
    var params = new URLSearchParams(window.location.search);
    var status = params.get('checkout');
    if (!status) return;

    if (status === 'success') {
      writeCart([]);
      closeDrawer();
      showOrderBanner("Thank you! Your order is confirmed — a receipt is on its way to your email.");
    } else if (status === 'cancelled') {
      showOrderBanner('Checkout was cancelled — your cart is still here whenever you\'re ready.');
    }

    // Clean the URL so refreshing the page doesn't re-trigger this.
    params.delete('checkout');
    params.delete('session_id');
    var qs = params.toString();
    var cleanUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // ---- 7. BOOT -------------------------------------------------------
  function init() {
    injectStyles();
    buildDrawer();
    render();
    wireCards();
    handleCheckoutReturn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
