import {
  STORES,
  PIZZA_MENU,
  CHEESE_OPTIONS,
  TOPPING_OPTIONS,
  validateLondonPostcode,
  fakeGeocode,
  haversineKm,
  estimateDeliveryMinutes,
  assignDriver,
  projectToMapFraction,
  THAMES_WAYPOINTS,
  PREP_MINUTES,
} from "./logic.js";

const PIZZA_EMOJI = {
  Margherita: "🍅",
  Hawaiian: "🍍",
  Pepperoni: "🍕",
  Vegetarian: "🥦",
  Chicken: "🍗",
  Custom: "🛠️",
};

const order = {
  store: null,
  pizza: null,
  sauce: "yes",
  cheese: null,
  toppings: [],
};

const stepIndicator = document.getElementById("step-indicator");
const steps = Array.from(document.querySelectorAll(".step"));

function showStep(stepNumber) {
  steps.forEach((section) => {
    section.hidden = Number(section.dataset.step) !== stepNumber;
  });
  Array.from(stepIndicator.children).forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle("active", n === stepNumber);
    li.classList.toggle("done", n < stepNumber);
  });
}

// --- Step 1: welcome -----------------------------------------------------
document.getElementById("to-step-2").addEventListener("click", () => showStep(2));

// --- Step 2: branch selection ---------------------------------------------
const branchMap = document.getElementById("branch-map");
const branchList = document.getElementById("branch-list");
const branchDetail = document.getElementById("branch-detail");
const branchDetailName = document.getElementById("branch-detail-name");
const branchSupportNumber = document.getElementById("branch-support-number");

// A stylised, illustrated-poster-style map: a dense street texture, a few
// tinted "neighbourhood" zones, a couple of parks, and a handful of bold
// trunk roads are original decorative artwork (not geographically precise).
// The river, however, is plotted from THAMES_WAYPOINTS' real coordinates
// via the same projection used for the branch pins, so it appears in its
// true position and shape relative to the branches.

// Builds a smooth SVG path through a series of points (quadratic curves
// through successive midpoints), avoiding sharp corners between waypoints.
function smoothPathThrough(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` Q ${last.x} ${last.y} ${last.x} ${last.y}`;
  return d;
}

const RIVER_HALF_WIDTH = 11;

function buildRiverRibbonPath() {
  const centerline = THAMES_WAYPOINTS.map(({ lat, lon }) => {
    const { xFraction, yFraction } = projectToMapFraction(lat, lon);
    return { x: xFraction * 400, y: yFraction * 300 };
  });
  const topEdge = centerline.map((p) => ({ x: p.x, y: p.y - RIVER_HALF_WIDTH }));
  const bottomEdge = centerline.map((p) => ({ x: p.x, y: p.y + RIVER_HALF_WIDTH })).reverse();
  return `${smoothPathThrough(topEdge)} L ${bottomEdge[0].x} ${bottomEdge[0].y} ${smoothPathThrough(
    bottomEdge
  ).replace(/^M[^Q]+/, "")} Z`;
}

const RIVER_PATH = buildRiverRibbonPath();

const TRUNK_ROADS = [
  { d: "M -10 40 L 410 90", color: "yellow" },
  { d: "M -10 120 L 410 60", color: "orange" },
  { d: "M 40 -10 L 90 310", color: "orange" },
  { d: "M 230 -10 L 180 310", color: "yellow" },
  { d: "M -10 250 L 410 260", color: "yellow" },
  { d: "M 300 -10 L 340 150 L 300 310", color: "orange" },
];

const NEIGHBOURHOOD_ZONES = [
  { cx: 90, cy: 70, rx: 70, ry: 55, color: "var(--zone-a)" },
  { cx: 260, cy: 55, rx: 90, ry: 50, color: "var(--zone-b)" },
  { cx: 340, cy: 150, rx: 60, ry: 70, color: "var(--zone-a)" },
  { cx: 120, cy: 150, rx: 65, ry: 55, color: "var(--zone-b)" },
  { cx: 220, cy: 250, rx: 80, ry: 45, color: "var(--zone-a)" },
];

const PARKS = [
  { cx: 60, cy: 200, rx: 28, ry: 20 },
  { cx: 350, cy: 250, rx: 24, ry: 18 },
];

branchMap.innerHTML = `
  <defs>
    <pattern id="street-grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M 16 0 L 0 0 0 16" class="map-grid-line" />
    </pattern>
  </defs>
  <rect x="0" y="0" width="400" height="300" class="map-background" rx="16" />
  <rect x="0" y="0" width="400" height="300" fill="url(#street-grid)" rx="16" />
  ${NEIGHBOURHOOD_ZONES.map(
    (z) => `<ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="${z.color}" class="map-zone" />`
  ).join("")}
  ${PARKS.map((p) => `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" class="map-park" />`).join("")}
  ${TRUNK_ROADS.map((r) => `<path d="${r.d}" class="map-road map-road-${r.color}" />`).join("")}
  <path d="${RIVER_PATH}" class="map-river" />
`;

const pinGroups = new Map();
STORES.forEach((store) => {
  const { xFraction, yFraction } = projectToMapFraction(store.lat, store.lon);
  const x = xFraction * 400;
  const y = yFraction * 300;
  const labelWidth = store.name.length * 6.7 + 20;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "map-pin");
  group.setAttribute("tabindex", "0");
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", `Select ${store.name} branch`);
  group.innerHTML = `
    <circle cx="${x}" cy="${y}" r="10" class="map-pin-ring" />
    <circle cx="${x}" cy="${y}" r="5.5" class="map-pin-dot" />
    <g class="map-pin-label">
      <rect x="${x - labelWidth / 2}" y="${y - 38}" width="${labelWidth}" height="22" rx="6" />
      <text x="${x}" y="${y - 22.5}" text-anchor="middle">${store.name}</text>
    </g>
  `;
  group.addEventListener("click", () => selectBranch(store));
  group.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") selectBranch(store);
  });
  branchMap.appendChild(group);
  pinGroups.set(store.name, group);
});

STORES.forEach((store) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "branch-card";
  button.textContent = store.name;
  button.addEventListener("click", () => selectBranch(store));
  branchList.appendChild(button);
});

function selectBranch(store) {
  order.store = store;

  pinGroups.forEach((group, name) => group.classList.toggle("selected", name === store.name));
  Array.from(branchList.children).forEach((btn) => btn.classList.toggle("selected", btn.textContent === store.name));

  branchDetailName.textContent = `${store.name} branch`;
  branchSupportNumber.hidden = true;
  branchDetail.hidden = false;
}

document.getElementById("branch-order-button").addEventListener("click", () => {
  showStep(3);
});

document.getElementById("branch-support-button").addEventListener("click", () => {
  branchSupportNumber.textContent = `📞 ${order.store.name} branch support: ${order.store.phone} (fake number, does not ring anywhere)`;
  branchSupportNumber.hidden = false;
});

// --- Step 3: pizza selection -------------------------------------------
const pizzaGrid = document.getElementById("pizza-grid");
const toStep4Button = document.getElementById("to-step-4");

PIZZA_MENU.forEach((pizza) => {
  const card = document.createElement("div");
  card.className = "pizza-card";
  card.dataset.pizza = pizza;
  card.innerHTML = `<span class="emoji">${PIZZA_EMOJI[pizza] ?? "🍕"}</span>${pizza}`;
  card.addEventListener("click", () => {
    order.pizza = pizza;
    Array.from(pizzaGrid.children).forEach((c) => c.classList.toggle("selected", c === card));
    toStep4Button.disabled = false;
  });
  pizzaGrid.appendChild(card);
});

document.getElementById("back-to-branch").addEventListener("click", () => showStep(2));

toStep4Button.addEventListener("click", () => {
  if (order.pizza === "Custom") {
    showStep(4);
  } else {
    showStep(5);
  }
});

// --- Step 4: customize (only for Custom pizza) --------------------------
const cheeseOptionsContainer = document.getElementById("cheese-options");
const toppingOptionsContainer = document.getElementById("topping-options");

CHEESE_OPTIONS.forEach((cheese) => {
  const label = document.createElement("label");
  label.className = "radio-option";
  label.innerHTML = `<input type="radio" name="cheese" value="${cheese}"> ${cheese}`;
  label.querySelector("input").addEventListener("change", () => {
    order.cheese = cheese;
  });
  cheeseOptionsContainer.appendChild(label);
});

TOPPING_OPTIONS.forEach((topping) => {
  const label = document.createElement("label");
  label.className = "checkbox-option";
  label.innerHTML = `<input type="checkbox" name="topping" value="${topping}"> ${topping}`;
  label.querySelector("input").addEventListener("change", (e) => {
    if (e.target.checked) {
      order.toppings.push(topping);
    } else {
      order.toppings = order.toppings.filter((t) => t !== topping);
    }
  });
  toppingOptionsContainer.appendChild(label);
});

document.querySelectorAll('input[name="sauce"]').forEach((input) => {
  input.addEventListener("change", (e) => {
    order.sauce = e.target.value;
  });
});

document.getElementById("back-to-step-3").addEventListener("click", () => showStep(3));

document.getElementById("to-step-5").addEventListener("click", () => {
  if (!order.cheese) {
    order.cheese = CHEESE_OPTIONS[0];
    cheeseOptionsContainer.querySelector("input").checked = true;
  }
  showStep(5);
});

// --- Step 5: customer details --------------------------------------------
const detailsForm = document.getElementById("details-form");
const detailsError = document.getElementById("details-error");

document.getElementById("back-to-pizza").addEventListener("click", () => {
  showStep(order.pizza === "Custom" ? 4 : 3);
});

detailsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  detailsError.hidden = true;

  const name = document.getElementById("customer-name").value.trim();
  const address = document.getElementById("customer-address").value.trim();
  const postcodeRaw = document.getElementById("customer-postcode").value.trim();

  if (!name) {
    return showDetailsError("Please enter your name.");
  }
  if (!address) {
    return showDetailsError("Please enter your delivery address.");
  }

  try {
    order.postcode = validateLondonPostcode(postcodeRaw);
  } catch (err) {
    return showDetailsError(err.message);
  }

  order.name = name;
  order.address = address;
  showStep(6);
});

function showDetailsError(message) {
  detailsError.textContent = message;
  detailsError.hidden = false;
}

// --- Step 6: payment (fake) ------------------------------------------------
const paymentForm = document.getElementById("payment-form");

document.getElementById("back-to-details").addEventListener("click", () => showStep(5));

paymentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  completeOrder();
});

// --- Step 7: confirmation --------------------------------------------------
const confirmationContent = document.getElementById("confirmation-content");

function completeOrder() {
  const customerLocation = fakeGeocode(order.postcode);
  const distanceKm = haversineKm(customerLocation.lat, customerLocation.lon, order.store.lat, order.store.lon);
  const totalMinutes = estimateDeliveryMinutes(distanceKm);
  const driver = assignDriver();

  const pizzaDescription =
    order.pizza === "Custom"
      ? `Custom pizza (${order.sauce === "yes" ? "with" : "no"} sauce, ${order.cheese} cheese${
          order.toppings.length ? `, topped with ${order.toppings.join(", ")}` : ", no extra toppings"
        })`
      : order.pizza;

  confirmationContent.innerHTML = `
    <p>Thanks, ${escapeHtml(order.name)} — your order is on its way!</p>
    <p><strong>Order:</strong> ${escapeHtml(pizzaDescription)}</p>
    <p><strong>Delivering to:</strong> ${escapeHtml(order.address)}, ${escapeHtml(order.postcode)}</p>
    <p><strong>Ordering from:</strong> Marubel Pizza's, ${order.store.name}</p>
    <p><strong>Delivery driver:</strong> ${driver}</p>
    <p><strong>Prep time:</strong> roughly ${PREP_MINUTES} minutes</p>
    <p><strong>Estimated delivery time:</strong> <span class="highlight">~${totalMinutes} minutes</span></p>
    <p>Have a great day! 🍕</p>
  `;
  showStep(7);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Start over --------------------------------------------------------
document.getElementById("start-over").addEventListener("click", () => {
  window.location.reload();
});

showStep(1);
