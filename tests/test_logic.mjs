// Plain-Node test runner: no dependencies, run with `node tests/test_logic.mjs`.
import assert from "node:assert/strict";
import {
  isValidUkPostcode,
  isLondonPostcode,
  validateLondonPostcode,
  normalizePostcode,
  haversineKm,
  fakeGeocode,
  estimateDeliveryMinutes,
  PREP_MINUTES,
  STORES,
  projectToMapFraction,
  MAP_BOUNDS,
  LONDON_BOUNDS,
  THAMES_WAYPOINTS,
  isValidCardNumber,
  luhnCheck,
  isValidExpiry,
  isValidCvv,
  PIZZAS,
  TOPPING_OPTIONS,
  getPizzaBasePrice,
  calculatePizzaPrice,
  formatGBP,
  nearestStore,
  EXTRA_TOPPING_PRICE,
} from "../logic.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(`    ${err.message}`);
  }
}

// --- Postcode validation -----------------------------------------------
test("valid London postcode passes format + area check", () => {
  assert.equal(isValidUkPostcode("SE1 6NP"), true);
  assert.equal(isLondonPostcode("SE1 6NP"), true);
});

test("normalizes postcode spacing and case", () => {
  assert.equal(normalizePostcode("se16np"), "SE1 6NP");
});

test("valid UK postcode outside London area is rejected", () => {
  assert.equal(isLondonPostcode("M1 1AE"), false); // Manchester
});

test("malformed postcode fails format check", () => {
  assert.equal(isValidUkPostcode("NOTAPOSTCODE"), false);
});

test("validateLondonPostcode throws on non-London postcode", () => {
  assert.throws(() => validateLondonPostcode("M1 1AE"));
});

test("validateLondonPostcode returns normalized postcode on success", () => {
  assert.equal(validateLondonPostcode("ec2m7ra"), "EC2M 7RA");
});

// --- Store data -------------------------------------------------------------
test("every store has a fake 020 7946 phone number", () => {
  for (const store of STORES) {
    assert.match(store.phone, /^020 7946 0\d{3}$/);
  }
});

test("every store has a unique phone number", () => {
  const numbers = STORES.map((s) => s.phone);
  assert.equal(new Set(numbers).size, numbers.length);
});

// --- Map projection ---------------------------------------------------------
test("projectToMapFraction keeps London coordinates within 0-1", () => {
  for (const store of STORES) {
    const { xFraction, yFraction } = projectToMapFraction(store.lat, store.lon);
    assert.ok(xFraction >= 0 && xFraction <= 1, `x out of range: ${xFraction}`);
    assert.ok(yFraction >= 0 && yFraction <= 1, `y out of range: ${yFraction}`);
  }
});

test("projectToMapFraction places higher latitude further up (smaller y)", () => {
  const north = projectToMapFraction(51.65, -0.1);
  const south = projectToMapFraction(51.35, -0.1);
  assert.ok(north.yFraction < south.yFraction);
});

test("MAP_BOUNDS contains every store, with room to spare", () => {
  for (const store of STORES) {
    assert.ok(store.lat > MAP_BOUNDS.minLat && store.lat < MAP_BOUNDS.maxLat, `${store.name} lat out of bounds`);
    assert.ok(store.lon > MAP_BOUNDS.minLon && store.lon < MAP_BOUNDS.maxLon, `${store.name} lon out of bounds`);
  }
});

test("stores are spread across most of the map, not clustered in a corner", () => {
  const fractions = STORES.map((s) => projectToMapFraction(s.lat, s.lon));
  const xSpread = Math.max(...fractions.map((f) => f.xFraction)) - Math.min(...fractions.map((f) => f.xFraction));
  const ySpread = Math.max(...fractions.map((f) => f.yFraction)) - Math.min(...fractions.map((f) => f.yFraction));
  assert.ok(xSpread > 0.5, `expected x spread > 0.5, got ${xSpread}`);
  assert.ok(ySpread > 0.5, `expected y spread > 0.5, got ${ySpread}`);
});

test("Waterloo and Elephant & Castle sit much closer to the real Thames than Colindale or Brent Cross", () => {
  const distanceToRiverKm = (store) =>
    Math.min(...THAMES_WAYPOINTS.map((w) => haversineKm(store.lat, store.lon, w.lat, w.lon)));

  const waterloo = STORES.find((s) => s.name === "Waterloo");
  const elephantAndCastle = STORES.find((s) => s.name === "Elephant & Castle");
  const colindale = STORES.find((s) => s.name === "Colindale");
  const brentCross = STORES.find((s) => s.name === "Brent Cross");

  assert.ok(distanceToRiverKm(waterloo) < 1, "Waterloo should be under 1km from the Thames");
  assert.ok(distanceToRiverKm(elephantAndCastle) < 2.5, "Elephant & Castle should be under 2.5km from the Thames");
  assert.ok(distanceToRiverKm(colindale) > 8, "Colindale should be well over 8km from the Thames");
  assert.ok(distanceToRiverKm(brentCross) > 8, "Brent Cross should be well over 8km from the Thames");
});

// --- Geocoding & distance -------------------------------------------------
test("fakeGeocode is deterministic for the same postcode", () => {
  const a = fakeGeocode("SE1 6NP");
  const b = fakeGeocode("se1 6np");
  assert.deepEqual(a, b);
});

test("fakeGeocode uses a real location for known districts (SE1 near Elephant & Castle/Waterloo)", () => {
  const location = fakeGeocode("SE1 6DX");
  const elephantAndCastle = STORES.find((s) => s.name === "Elephant & Castle");
  const distanceKm = haversineKm(location.lat, location.lon, elephantAndCastle.lat, elephantAndCastle.lon);
  assert.ok(distanceKm < 3, `expected SE1 6DX within 3km of Elephant & Castle, got ${distanceKm}km`);
});

test("fakeGeocode keeps different postcodes in the same district close but not identical", () => {
  const a = fakeGeocode("SE1 6DX");
  const b = fakeGeocode("SE1 9RT");
  assert.notDeepEqual(a, b);
  assert.ok(haversineKm(a.lat, a.lon, b.lat, b.lon) < 2, "expected same-district jitter to stay within ~2km");
});

test("fakeGeocode falls back to the wide bounding box for districts not in the lookup table", () => {
  const location = fakeGeocode("ZZ99 9ZZ");
  assert.ok(location.lat >= LONDON_BOUNDS.minLat && location.lat <= LONDON_BOUNDS.maxLat);
  assert.ok(location.lon >= LONDON_BOUNDS.minLon && location.lon <= LONDON_BOUNDS.maxLon);
});

test("haversineKm returns 0 for identical points", () => {
  assert.equal(haversineKm(51.5, -0.1, 51.5, -0.1), 0);
});

test("haversineKm returns a sensible distance between two known London points", () => {
  // Waterloo to Moorgate is roughly 3-4 km as the crow flies.
  const distance = haversineKm(51.5031, -0.1132, 51.5186, -0.0886);
  assert.ok(distance > 1 && distance < 6, `expected ~1-6km, got ${distance}`);
});

// --- Delivery estimate -----------------------------------------------------
test("estimateDeliveryMinutes includes prep time as a floor", () => {
  assert.equal(estimateDeliveryMinutes(0), PREP_MINUTES);
});

test("estimateDeliveryMinutes grows with distance", () => {
  assert.ok(estimateDeliveryMinutes(10) > estimateDeliveryMinutes(1));
});

// --- Card validation (fake, currently unused by script.js) -----------------
test("luhnCheck accepts a known-valid test card number", () => {
  assert.equal(luhnCheck("4242424242424242"), true); // standard Stripe test card
});

test("luhnCheck rejects a number with a bad check digit", () => {
  assert.equal(luhnCheck("4242424242424241"), false);
});

test("isValidCardNumber rejects non-numeric input", () => {
  assert.equal(isValidCardNumber("4242-4242-4242-4242abc"), false);
});

test("isValidCardNumber rejects too-short numbers", () => {
  assert.equal(isValidCardNumber("4242"), false);
});

test("isValidExpiry accepts a date that hasn't expired yet", () => {
  const now = new Date(2026, 5, 1); // June 2026
  assert.equal(isValidExpiry("01/30", now), true); // Jan 2030 is in the future
  assert.equal(isValidExpiry("06/26", now), true); // expires this same month is still valid
});

test("isValidExpiry rejects an expired date", () => {
  const now = new Date(2026, 5, 1); // June 2026
  assert.equal(isValidExpiry("01/25", now), false);
});

test("isValidExpiry rejects malformed input", () => {
  assert.equal(isValidExpiry("13/25"), false);
  assert.equal(isValidExpiry("1/25"), false);
});

test("isValidCvv accepts exactly 3 digits", () => {
  assert.equal(isValidCvv("123"), true);
  assert.equal(isValidCvv("12"), false);
  assert.equal(isValidCvv("1234"), false);
});

// --- Pizza pricing -----------------------------------------------------
test("preset pizza base prices match the menu (Small 7, Medium 12, Large 18)", () => {
  assert.equal(getPizzaBasePrice("margherita", "Small"), 7);
  assert.equal(getPizzaBasePrice("margherita", "Medium"), 12);
  assert.equal(getPizzaBasePrice("margherita", "Large"), 18);
});

test("custom pizza starts cheaper than presets at every size", () => {
  assert.equal(getPizzaBasePrice("custom", "Small"), 3);
  assert.ok(getPizzaBasePrice("custom", "Medium") < getPizzaBasePrice("margherita", "Medium"));
  assert.ok(getPizzaBasePrice("custom", "Large") < getPizzaBasePrice("margherita", "Large"));
});

test("getPizzaBasePrice rejects an unknown size", () => {
  assert.throws(() => getPizzaBasePrice("margherita", "Extra-Large"));
});

test("calculatePizzaPrice adds extra topping cost on top of the base price", () => {
  const base = getPizzaBasePrice("pepperoni", "Medium");
  assert.equal(calculatePizzaPrice("pepperoni", "Medium", 0), base);
  assert.equal(calculatePizzaPrice("pepperoni", "Medium", 2), base + 2 * EXTRA_TOPPING_PRICE);
});

test("every preset pizza's base toppings come from the shared topping list (except sauce/cheese)", () => {
  const nonToppingIngredients = ["Tomato Sauce", "Mozzarella"];
  for (const pizza of PIZZAS) {
    if (pizza.id === "custom") continue;
    for (const ingredient of pizza.baseToppings) {
      const isKnown = nonToppingIngredients.includes(ingredient) || TOPPING_OPTIONS.includes(ingredient);
      assert.ok(isKnown, `${pizza.name} has unrecognised ingredient "${ingredient}"`);
    }
  }
});

test("formatGBP formats as pounds with 2 decimal places", () => {
  assert.equal(formatGBP(7), "£7.00");
  assert.equal(formatGBP(9.9), "£9.90");
  assert.equal(formatGBP(12.345), "£12.35");
});

// --- Nearest store (postcode finder) ----------------------------------------
test("nearestStore finds Elephant & Castle for a nearby SE1 postcode", () => {
  const result = nearestStore("SE1 6DX");
  assert.equal(result.store.name, "Elephant & Castle");
  assert.ok(result.distanceKm < 3, `expected < 3km, got ${result.distanceKm}`);
});

test("nearestStore finds Colindale for a nearby NW9 postcode", () => {
  const result = nearestStore("NW9 5AB");
  assert.equal(result.store.name, "Colindale");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
