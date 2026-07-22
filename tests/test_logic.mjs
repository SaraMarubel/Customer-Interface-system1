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
  isValidCardNumber,
  luhnCheck,
  isValidExpiry,
  isValidCvv,
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

// --- Geocoding & distance -------------------------------------------------
test("fakeGeocode is deterministic for the same postcode", () => {
  const a = fakeGeocode("SE1 6NP");
  const b = fakeGeocode("se1 6np");
  assert.deepEqual(a, b);
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
