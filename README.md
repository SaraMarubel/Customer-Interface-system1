# Marubel Pizza's — Customer Ordering Interface

A small, dependency-free web app simulating a full pizza ordering flow for a
fictional London pizzeria chain, **Marubel Pizza's**. Find your nearest
branch, choose pickup or delivery, build any pizza on the menu with your own
toppings, add drinks, review an itemised receipt, "pay" with a fake card,
and get an order confirmation.

[![CI](https://github.com/SaraMarubel/Customer-interface-system1/actions/workflows/ci.yml/badge.svg)](https://github.com/SaraMarubel/Customer-interface-system1/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What it does

1. **Welcome** — a landing screen introducing Marubel Pizza's.
2. **Choose a branch** — type a postcode into the "find your nearest branch"
   box to auto-select the closest one, or pick one yourself from an original,
   illustrated-poster-style map of Greater London (flat colours, a textured
   street grid, tinted neighbourhoods, park blobs, bold trunk roads, and a
   river ribbon) with a pin for each of the 7 branches, or from the plain
   list underneath. Once a branch is selected, choose **Pickup** or
   **Delivery** (the two big, primary actions) or **Contact support**, which
   reveals that branch's phone number. Branches are named after, and placed
   at, the station each sits next to: Elephant & Castle, Colindale, Kentish
   Town, Waterloo, Brent Cross, Camden Town, Moorgate.
3. **Choose your pizza(s)** — Margherita, Hawaiian, Pepperoni, Vegetarian,
   Chicken, or a **Custom** build (sauce yes/no, choice of cheese). Every
   pizza, preset or custom, shows a one-line description of what's on it and
   lets you uncheck any included ingredient or add extra toppings
   (+£1.99 each), in Small/Medium/Large sizes with their own prices. Set a
   quantity and add it to your order — then pick another pizza and repeat to
   order more than one type in the same order.
4. **Add drinks (optional)** — Water, Sprite, or Coca-Cola, £2 each, with the
   same quantity-and-add mechanic as pizzas.
5. **Enter your details** — always your name; if you chose delivery, also an
   address and postcode, validated against the standard UK postcode format
   *and* checked that it falls in a London postcode area (`E`, `EC`, `N`,
   `NW`, `SE`, `SW`, `W`, `WC`). Pickup orders skip the address entirely —
   just give your name at the counter.
6. **Time estimate** — pickup orders are told it'll be ready in the standard
   ~15 minute prep time; delivery orders get an estimate combining that prep
   time with real travel time (via the haversine distance) from the branch to
   the delivery postcode.
7. **Receipt** — an itemised, scrollable, till-receipt-styled summary of
   every pizza and drink, the subtotal, the £2.99 delivery fee (or "FREE"
   for pickup), and the total, with a "Continue to pay" button.
8. **"Pay"** — a card form that is clearly labeled as fake. No payment is
   ever processed and no details are transmitted or stored anywhere. Real
   format-checking code exists for this (see
   [Payment validation](#payment-validation-currently-disabled) below) but is
   currently switched off so the fields accept anything — handy while
   testing the order flow.
9. **Confirmation** — for delivery, a random driver (Bob, Kevin, Andrew,
   Maria, or Charlotte) plus the delivery estimate; for pickup, a reminder of
   the branch, ready time, and the name to give at the counter. Either way,
   the total paid is shown again.

## Menu & pricing

| Item | Small | Medium | Large |
|---|---|---|---|
| Margherita / Hawaiian / Pepperoni / Vegetarian / Chicken | £7.00 | £12.00 | £18.00 |
| Custom | £3.00 | £8.00 | £14.00 |

- Extra toppings (on any pizza, preset or custom): **+£1.99 each**
- Drinks (Water, Sprite, Coca-Cola): **£2.00 each**
- Delivery fee: **£2.99** (pickup is free)

All prices live in one place, [`logic.js`](logic.js)'s `getPizzaBasePrice()` /
`calculatePizzaPrice()` / `EXTRA_TOPPING_PRICE` / `DRINK_PRICE` /
`DELIVERY_FEE`, and are covered by `tests/test_logic.mjs`.

## Important: what's real and what's simulated

- **Store locations are real, and the map is genuinely to scale.** The
  branch-picker map isn't zoomed out to all of Greater London — `MAP_BOUNDS`
  is computed directly from the 7 stores' coordinates (with padding), and
  corrected for the fact that a degree of longitude covers less real
  distance than a degree of latitude at London's latitude, so relative
  positions and distances between branches are proportionally accurate, not
  stretched or squashed. The river Thames is plotted from `THAMES_WAYPOINTS`
  — real coordinates for 10 real bridges (Kew Bridge to Tower Bridge) — using
  the same projection as the pins, so it runs through its true position and
  shape: Waterloo and Elephant & Castle sit right by it, while Colindale and
  Brent Cross are correctly several kilometres north of it. The streets,
  neighbourhood tints, parks, and roads around all of that are original
  decorative artwork, not geographically real — there's no actual map tile
  or map API involved, since this is an offline, dependency-free static site.
- **Phone numbers are fake by design.** Each branch uses a number in the
  `020 7946 0xxx` block, which Ofcom reserves specifically for fictional use
  in dramas and demos, so none of them can ring a real phone.
- **Geocoding is simulated, but accurate for known districts.** Turning a
  postcode into a map coordinate normally requires an external geocoding API
  (e.g. [postcodes.io](https://postcodes.io)), which this offline demo can't
  call. Instead, `fakeGeocode()` first checks the postcode's district (e.g.
  "SE1", "NW9") against a built-in table of ~40 real London districts and
  their actual approximate coordinates (with a small deterministic jitter so
  postcodes sharing a district aren't all identical) — so recognisable
  postcodes, including ones near our own branches, get a genuinely accurate
  location and delivery estimate. Only postcodes in a district *outside*
  that table fall back to a pseudo-random location within Greater London,
  using the real [haversine formula](https://en.wikipedia.org/wiki/Haversine_formula)
  for distance either way.
- **Payment is entirely fake.** No card details are sent anywhere. Format
  validation for them exists in the code but is deliberately disabled —
  see below.

## Payment validation (currently disabled)

`logic.js` includes fully working, tested card-format validation — a real
[Luhn checksum](https://en.wikipedia.org/wiki/Luhn_algorithm) on the card
number, an expiry check that rejects dates already in the past, and a
3-digit CVV check:

```js
export function isValidCardNumber(raw) {
  const digits = String(raw).replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  return luhnCheck(digits);
}

export function luhnCheck(digits) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function isValidExpiry(raw, now = new Date()) {
  const match = String(raw).trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return false;
  const month = parseInt(match[1], 10);
  const year = 2000 + parseInt(match[2], 10);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

export function isValidCvv(raw) {
  return /^\d{3}$/.test(String(raw).trim());
}
```

It's **switched off** in `script.js`'s payment submit handler right now, on
purpose — so trying out the order flow doesn't require typing a
Luhn-valid card number every time. To turn it back on, import these four
functions in `script.js` and check them before calling `completeOrder()`
in the `payment-form` submit listener, e.g.:

```js
if (!isValidCardNumber(cardNumber.value)) return showError("Invalid card number");
if (!isValidExpiry(cardExpiry.value)) return showError("Card has expired");
if (!isValidCvv(cardCvv.value)) return showError("Invalid CVV");
completeOrder();
```

The functions are still fully covered by `tests/test_logic.mjs`, so they
stay verified even while dormant.

## Project structure

```
index.html    # page structure — the 9-step order wizard
style.css      # styling
logic.js        # pure logic: menu/pricing, validation, geocoding, distance, delivery estimate
script.js        # DOM wiring — imports logic.js, drives the wizard and the pizza/drink cart
tests/
└── test_logic.mjs   # plain-Node tests for logic.js (no dependencies)
```

`logic.js` has no DOM dependency, so the exact same module is used by the
browser (via `script.js`) and by the test suite — nothing is duplicated or
re-implemented for testing.

## Running it locally

No build step or dependencies — just serve the folder and open it:

```bash
cd Customer-interface-system1
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

(Opening `index.html` directly from disk also mostly works, but some
browsers restrict ES module imports over `file://`, so a local server is
more reliable.)

## Running the tests

Requires [Node.js](https://nodejs.org) (no npm packages needed):

```bash
node tests/test_logic.mjs
```

## Extending it further

This follows a simple, repeatable pattern — add a case to the relevant list
in `logic.js` (e.g. another pizza, another store, another driver, another
drink), or add a new pure function alongside the existing ones and a
matching test in `tests/test_logic.mjs`. Ideas: real geocoding via a free
API, an order history "database" (e.g. via `localStorage` or IndexedDB),
discount codes, scheduled/future orders instead of "as soon as possible."

## License

MIT — see [LICENSE](LICENSE).
