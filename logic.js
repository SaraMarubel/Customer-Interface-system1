// Pure logic for Marubel Pizza's ordering system: no DOM access here, so it
// can be imported both by the browser (script.js) and by plain Node for
// tests, with no build step or dependencies required.

// Each pizzeria sits next to the named London Underground/rail station.
// Coordinates are the real approximate station locations. Phone numbers use
// the 020 7946 0xxx block, which Ofcom reserves specifically for fictional
// use in dramas and demos, so these are guaranteed not to reach a real line.
export const STORES = [
  { name: "Elephant & Castle", lat: 51.4943, lon: -0.1, phone: "020 7946 0101" },
  { name: "Colindale", lat: 51.5955, lon: -0.2494, phone: "020 7946 0102" },
  { name: "Kentish Town", lat: 51.5507, lon: -0.1402, phone: "020 7946 0103" },
  { name: "Waterloo", lat: 51.5031, lon: -0.1132, phone: "020 7946 0104" },
  { name: "Brent Cross", lat: 51.5765, lon: -0.213, phone: "020 7946 0105" },
  { name: "Camden Town", lat: 51.539, lon: -0.1426, phone: "020 7946 0106" },
  { name: "Moorgate", lat: 51.5186, lon: -0.0886, phone: "020 7946 0107" },
];

export const DRIVERS = ["Bob", "Kevin", "Andrew", "Maria", "Charlotte"];

export const PREP_MINUTES = 15;
const AVERAGE_DELIVERY_SPEED_KMH = 20; // rough city moped speed

// Each preset pizza lists its own included ingredients (shown as removable
// in the UI, though removing one doesn't change the price — same as most
// real pizzerias). "Custom" has no included ingredients: every topping on
// it is an extra. All prices are in GBP.
export const PIZZAS = [
  {
    id: "margherita",
    name: "Margherita",
    description: "A classic with tomato sauce and melted mozzarella.",
    baseToppings: ["Tomato Sauce", "Mozzarella"],
  },
  {
    id: "hawaiian",
    name: "Hawaiian",
    description: "Tomato sauce and mozzarella topped with ham and pineapple.",
    baseToppings: ["Tomato Sauce", "Mozzarella", "Ham", "Pineapple"],
  },
  {
    id: "pepperoni",
    name: "Pepperoni",
    description: "Tomato sauce and mozzarella loaded with pepperoni.",
    baseToppings: ["Tomato Sauce", "Mozzarella", "Pepperoni"],
  },
  {
    id: "vegetarian",
    name: "Vegetarian",
    description: "Tomato sauce and mozzarella with peppers, onion, and mushroom.",
    baseToppings: ["Tomato Sauce", "Mozzarella", "Peppers", "Onion", "Mushroom"],
  },
  {
    id: "chicken",
    name: "Chicken",
    description: "Tomato sauce and mozzarella topped with grilled chicken.",
    baseToppings: ["Tomato Sauce", "Mozzarella", "Chicken"],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Build your own from scratch: choose your sauce, cheese, and any toppings.",
    baseToppings: [],
  },
];

export const CHEESE_OPTIONS = ["Low-fat", "Mozzarella"];
export const TOPPING_OPTIONS = ["Pepperoni", "Chicken", "Ham", "Pineapple", "Peppers", "Onion", "Mushroom", "Extra Cheese"];
export const PIZZA_SIZES = ["Small", "Medium", "Large"];
export const DRINKS = ["Water", "Sprite", "Coca-Cola"];

export const EXTRA_TOPPING_PRICE = 1.99;
export const DRINK_PRICE = 2.0;
export const DELIVERY_FEE = 2.99;

const PRESET_SIZE_PRICES = { Small: 7, Medium: 12, Large: 18 };
const CUSTOM_SIZE_PRICES = { Small: 3, Medium: 8, Large: 14 };

export function getPizzaBasePrice(pizzaId, size) {
  const prices = pizzaId === "custom" ? CUSTOM_SIZE_PRICES : PRESET_SIZE_PRICES;
  const price = prices[size];
  if (price === undefined) throw new Error(`Unknown pizza size: ${size}`);
  return price;
}

export function calculatePizzaPrice(pizzaId, size, extraToppingsCount) {
  return getPizzaBasePrice(pizzaId, size) + extraToppingsCount * EXTRA_TOPPING_PRICE;
}

export function formatGBP(amount) {
  return `£${amount.toFixed(2)}`;
}

// --- Postcode validation ---------------------------------------------------
//
// Standard UK postcode format, e.g. "SE1 6NP", "NW9 5AB", "EC2M 7RA".
const UK_POSTCODE_REGEX = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s?([0-9][A-Z]{2})$/i;

// "London" postcode areas are the outward-code letter prefixes historically
// assigned to the London postal district: E, EC, N, NW, SE, SW, W, WC.
const LONDON_AREAS = ["E", "EC", "N", "NW", "SE", "SW", "W", "WC"];

export function normalizePostcode(raw) {
  const compact = String(raw).toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkPostcode(raw) {
  return UK_POSTCODE_REGEX.test(String(raw).trim());
}

export function isLondonPostcode(raw) {
  const match = String(raw).trim().toUpperCase().match(/^[A-Z]+/);
  if (!match) return false;
  return LONDON_AREAS.includes(match[0]);
}

export function validateLondonPostcode(raw) {
  if (!isValidUkPostcode(raw)) {
    throw new Error("That doesn't look like a valid UK postcode (e.g. SE1 6NP).");
  }
  if (!isLondonPostcode(raw)) {
    throw new Error("Sorry, we only deliver to London postcodes (E, EC, N, NW, SE, SW, W, WC).");
  }
  return normalizePostcode(raw);
}

// --- Fake geocoding & distance ----------------------------------------------
//
// A real system would call a geocoding API (e.g. postcodes.io) to turn a
// postcode into coordinates. This project has no network access and delivery
// accuracy isn't the point, so instead we deterministically derive a
// pseudo-location for a postcode, constrained to Greater London's bounding
// box. The same postcode always maps to the same point.
export const LONDON_BOUNDS = { minLat: 51.28, maxLat: 51.7, minLon: -0.51, maxLon: 0.2 };

// Real approximate coordinates of Thames bridges/crossings, west to east,
// used to draw the river on the branch-picker map in roughly its true shape
// and position (the southward bulge around Putney/Wandsworth/Battersea, then
// north through Vauxhall/Westminster/Waterloo, peaking near Blackfriars).
export const THAMES_WAYPOINTS = [
  { name: "Kew Bridge", lat: 51.4886, lon: -0.29 },
  { name: "Hammersmith Bridge", lat: 51.4854, lon: -0.2277 },
  { name: "Putney Bridge", lat: 51.4682, lon: -0.2103 },
  { name: "Battersea Bridge", lat: 51.4784, lon: -0.171 },
  { name: "Vauxhall Bridge", lat: 51.4861, lon: -0.1246 },
  { name: "Westminster Bridge", lat: 51.501, lon: -0.1211 },
  { name: "Waterloo Bridge", lat: 51.5075, lon: -0.1147 },
  { name: "Blackfriars Bridge", lat: 51.5106, lon: -0.1035 },
  { name: "London Bridge", lat: 51.5079, lon: -0.0877 },
  { name: "Tower Bridge", lat: 51.5055, lon: -0.0754 },
];

// The map viewBox is 400x300 (a 4:3 aspect ratio) — matched here so a real
// straight-line distance looks the same length whichever direction it runs.
const MAP_VIEWBOX_WIDTH = 400;
const MAP_VIEWBOX_HEIGHT = 300;
const KM_PER_DEGREE_LAT = 111;

// The map "zooms in" to just the area actually covered by our branches (plus
// some padding), rather than all of Greater London — otherwise the branches
// end up clustered in a small corner of the picture. Aspect-corrected using
// each degree of longitude's real length at London's latitude, so the map
// isn't stretched and pins/river line up with their true relative positions.
function computeMapBounds(points, paddingFraction = 0.35) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const kmPerDegreeLon = KM_PER_DEGREE_LAT * Math.cos((centerLat * Math.PI) / 180);

  let latRangeKm = (maxLat - minLat) * KM_PER_DEGREE_LAT * (1 + paddingFraction);
  let lonRangeKm = (maxLon - minLon) * kmPerDegreeLon * (1 + paddingFraction);

  const targetAspect = MAP_VIEWBOX_WIDTH / MAP_VIEWBOX_HEIGHT;
  if (lonRangeKm / latRangeKm < targetAspect) {
    lonRangeKm = latRangeKm * targetAspect;
  } else {
    latRangeKm = lonRangeKm / targetAspect;
  }

  const latRangeDeg = latRangeKm / KM_PER_DEGREE_LAT;
  const lonRangeDeg = lonRangeKm / kmPerDegreeLon;

  return {
    minLat: centerLat - latRangeDeg / 2,
    maxLat: centerLat + latRangeDeg / 2,
    minLon: centerLon - lonRangeDeg / 2,
    maxLon: centerLon + lonRangeDeg / 2,
  };
}

export const MAP_BOUNDS = computeMapBounds(STORES);

// Projects a lat/lon into a 0-1 x/y fraction of MAP_BOUNDS, for placing a pin
// (or the river) on the stylised map.
export function projectToMapFraction(lat, lon) {
  return {
    xFraction: (lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon),
    yFraction: (MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat),
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // force 32-bit int
  }
  return Math.abs(hash);
}

// Approximate real centroids for common London postcode districts (the
// outward code minus any trailing sector letter, e.g. "SE1", "NW9", "EC2").
// This isn't a full geocoding database — a real one has ~2 million UK
// postcodes — but covering the well-known districts means postcodes people
// actually recognise (including our own branches' own SE1/NW1/NW5/NW9/EC2)
// get a genuinely accurate location instead of a random one.
const POSTCODE_DISTRICT_COORDINATES = {
  EC1: { lat: 51.525, lon: -0.1015 },
  EC2: { lat: 51.5186, lon: -0.0886 },
  EC3: { lat: 51.5121, lon: -0.0797 },
  EC4: { lat: 51.5138, lon: -0.1027 },
  E1: { lat: 51.515, lon: -0.0722 },
  E2: { lat: 51.5292, lon: -0.0553 },
  E3: { lat: 51.5285, lon: -0.0246 },
  E8: { lat: 51.5461, lon: -0.0554 },
  E14: { lat: 51.505, lon: -0.0197 },
  E17: { lat: 51.586, lon: -0.011 },
  N1: { lat: 51.5362, lon: -0.1033 },
  N4: { lat: 51.5701, lon: -0.1052 },
  N7: { lat: 51.554, lon: -0.118 },
  N16: { lat: 51.5605, lon: -0.0748 },
  N22: { lat: 51.5977, lon: -0.1097 },
  NW1: { lat: 51.539, lon: -0.1426 },
  NW3: { lat: 51.5566, lon: -0.178 },
  NW4: { lat: 51.5875, lon: -0.2274 },
  NW5: { lat: 51.5507, lon: -0.1402 },
  NW6: { lat: 51.5457, lon: -0.192 },
  NW9: { lat: 51.5955, lon: -0.2494 },
  NW10: { lat: 51.539, lon: -0.244 },
  SE1: { lat: 51.4998, lon: -0.0994 },
  SE5: { lat: 51.4744, lon: -0.0918 },
  SE10: { lat: 51.4805, lon: 0.0025 },
  SE11: { lat: 51.4913, lon: -0.109 },
  SE15: { lat: 51.4739, lon: -0.0658 },
  SE22: { lat: 51.4544, lon: -0.0714 },
  SW1: { lat: 51.4975, lon: -0.1357 },
  SW3: { lat: 51.4875, lon: -0.1687 },
  SW4: { lat: 51.4633, lon: -0.1367 },
  SW6: { lat: 51.4759, lon: -0.2019 },
  SW11: { lat: 51.4649, lon: -0.1642 },
  SW19: { lat: 51.4214, lon: -0.2064 },
  W1: { lat: 51.5152, lon: -0.1417 },
  W2: { lat: 51.5152, lon: -0.1755 },
  W6: { lat: 51.4927, lon: -0.2339 },
  W10: { lat: 51.5205, lon: -0.216 },
  W12: { lat: 51.5074, lon: -0.232 },
  WC1: { lat: 51.5246, lon: -0.1218 },
  WC2: { lat: 51.5136, lon: -0.1231 },
};

// Small deterministic offset so postcodes sharing a district (e.g. every SE1
// postcode) don't all land on the exact same point, while staying within
// the same neighbourhood.
const DISTRICT_JITTER_DEGREES = 0.006; // roughly +/- 650m

function lookupPostcodeDistrict(normalizedPostcode) {
  const outwardCode = normalizedPostcode.split(" ")[0];
  const match = outwardCode.match(/^([A-Z]+)(\d+)/);
  if (!match) return null;
  return POSTCODE_DISTRICT_COORDINATES[`${match[1]}${match[2]}`] ?? null;
}

export function fakeGeocode(postcode) {
  const normalized = normalizePostcode(postcode);
  const hash = hashString(normalized);
  const districtCoordinates = lookupPostcodeDistrict(normalized);

  if (districtCoordinates) {
    const latJitter = (((hash % 1009) / 1009) * 2 - 1) * DISTRICT_JITTER_DEGREES;
    const lonJitter = ((Math.floor(hash / 1009) % 1009) / 1009) * 2 - 1;
    return {
      lat: districtCoordinates.lat + latJitter,
      lon: districtCoordinates.lon + lonJitter * DISTRICT_JITTER_DEGREES,
    };
  }

  // Fallback for districts not in the table above: a deterministic
  // pseudo-location within Greater London (not the district's real
  // position — see the README for why a full geocoding lookup isn't used).
  const latFraction = (hash % 10007) / 10007;
  const lonFraction = (Math.floor(hash / 10007) % 10007) / 10007;
  return {
    lat: LONDON_BOUNDS.minLat + latFraction * (LONDON_BOUNDS.maxLat - LONDON_BOUNDS.minLat),
    lon: LONDON_BOUNDS.minLon + lonFraction * (LONDON_BOUNDS.maxLon - LONDON_BOUNDS.minLon),
  };
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Finds the closest branch to a postcode (via fakeGeocode), for the "find my
// nearest branch" box above the map.
export function nearestStore(postcode) {
  const location = fakeGeocode(postcode);
  let closest = null;
  for (const store of STORES) {
    const distanceKm = haversineKm(location.lat, location.lon, store.lat, store.lon);
    if (!closest || distanceKm < closest.distanceKm) {
      closest = { store, distanceKm };
    }
  }
  return closest;
}

export function estimateDeliveryMinutes(distanceKm) {
  const travelMinutes = (distanceKm / AVERAGE_DELIVERY_SPEED_KMH) * 60;
  return Math.round(PREP_MINUTES + travelMinutes);
}

export function assignDriver() {
  return DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
}

// --- Card validation (FAKE — no real payment is ever processed) -----------
//
// These functions are fully working but intentionally NOT called by
// script.js right now, so the payment step accepts anything while testing
// the order flow. See the "Payment validation" section in the README for
// how to wire them back into the payment form.

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
  const match = String(raw)
    .trim()
    .match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
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
