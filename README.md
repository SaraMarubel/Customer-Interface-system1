# Marubel Pizza's — Customer Ordering Interface

A small, dependency-free web app simulating a pizza ordering flow for a
fictional London pizzeria chain, **Marubel Pizza's**. Pick a pizza, customize
it, enter delivery details, "pay" with a fake card, and get an order
confirmation with an assigned driver and estimated delivery time.

[![CI](https://github.com/SaraMarubel/Customer-interface-system1/actions/workflows/ci.yml/badge.svg)](https://github.com/SaraMarubel/Customer-interface-system1/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What it does

1. **Choose a pizza** — Margherita, Hawaiian, Pepperoni, Vegetarian, Chicken,
   or a **Custom** build (sauce yes/no, Low-fat or Mozzarella cheese, and any
   combination of toppings).
2. **Enter your details** — name, address, and a postcode, which is validated
   against the standard UK postcode format *and* checked that it falls in a
   London postcode area (`E`, `EC`, `N`, `NW`, `SE`, `SW`, `W`, `WC`).
3. **"Pay"** — a card form that is clearly labeled as fake. No payment is
   ever processed and no details are transmitted or stored anywhere; the
   digits are only checked for a plausible format (length, a valid
   [Luhn checksum](https://en.wikipedia.org/wiki/Luhn_algorithm), a real
   expiry format that hasn't passed, and a 3-digit CVV).
4. **Get an order confirmation** — the app works out which of Marubel's 7
   real London locations (each named after the station it sits next to:
   Elephant & Castle, Colindale, Kentish Town, Waterloo, Brent Cross, Camden
   Town, Moorgate) is closest to the delivery postcode, assigns a random
   delivery driver (Bob, Kevin, Andrew, Maria, or Charlotte), and estimates a
   delivery time from a ~15 minute prep time plus travel time.

## Important: what's real and what's simulated

- **Store locations** are real approximate coordinates for those 7 stations.
- **Distance/geocoding is simulated.** Turning a postcode into a map
  coordinate normally requires an external geocoding API (e.g.
  [postcodes.io](https://postcodes.io)), which this offline demo doesn't
  call. Instead, [`logic.js`](logic.js)'s `fakeGeocode()` deterministically
  derives a pseudo-location for a postcode within Greater London's bounding
  box, so the same postcode always gets the same "location" and a real
  distance formula (the [haversine formula](https://en.wikipedia.org/wiki/Haversine_formula))
  still produces a plausible-looking distance and delivery estimate — it
  just isn't the postcode's real-world location.
- **Payment is entirely fake.** No card details are sent anywhere; only
  their format is validated client-side.

## Project structure

```
index.html    # page structure — the 5-step order wizard
style.css      # styling
logic.js        # pure logic: validation, geocoding, distance, delivery estimate
script.js        # DOM wiring — imports logic.js, drives the wizard
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
in `logic.js` (e.g. another pizza, another store, another driver), or add a
new pure function alongside the existing ones and a matching test in
`tests/test_logic.mjs`. Ideas: real geocoding via a free API, order pricing,
an order history "database" (e.g. via `localStorage` or IndexedDB), multiple
custom pizzas per order.

## License

MIT — see [LICENSE](LICENSE).
