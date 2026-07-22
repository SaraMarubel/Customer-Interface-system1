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

export const PIZZA_MENU = ["Margherita", "Hawaiian", "Pepperoni", "Vegetarian", "Chicken", "Custom"];
export const CHEESE_OPTIONS = ["Low-fat", "Mozzarella"];
export const TOPPING_OPTIONS = ["Peppers", "Pineapple", "Pepperoni", "Chicken", "Onion", "Mushroom"];

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

export function fakeGeocode(postcode) {
  const normalized = normalizePostcode(postcode);
  const hash = hashString(normalized);
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
