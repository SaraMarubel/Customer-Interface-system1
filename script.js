import {
  STORES,
  PIZZAS,
  CHEESE_OPTIONS,
  TOPPING_OPTIONS,
  PIZZA_SIZES,
  DRINKS,
  EXTRA_TOPPING_PRICE,
  DRINK_PRICE,
  DELIVERY_FEE,
  calculatePizzaPrice,
  formatGBP,
  validateLondonPostcode,
  nearestStore,
  fakeGeocode,
  haversineKm,
  estimateDeliveryMinutes,
  assignDriver,
  projectToMapFraction,
  THAMES_WAYPOINTS,
  PREP_MINUTES,
} from "./logic.js";

const PIZZA_EMOJI = {
  margherita: "🍅",
  hawaiian: "🍍",
  pepperoni: "🍕",
  vegetarian: "🥦",
  chicken: "🍗",
  custom: "🛠️",
};

const DRINK_EMOJI = {
  Water: "💧",
  Sprite: "🍋",
  "Coca-Cola": "🥫",
};

const order = {
  store: null,
  fulfillment: null, // "pickup" | "delivery"
  cart: { pizzas: [], drinks: [] },
  name: "",
  address: "",
  postcode: "",
  deliveryMinutes: null,
  total: 0,
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

// "Find my nearest branch" postcode box.
const finderInput = document.getElementById("finder-postcode");
const finderButton = document.getElementById("finder-button");
const finderError = document.getElementById("finder-error");
const finderResult = document.getElementById("finder-result");

finderButton.addEventListener("click", () => {
  finderError.hidden = true;
  finderResult.hidden = true;

  let normalized;
  try {
    normalized = validateLondonPostcode(finderInput.value);
  } catch (err) {
    finderError.textContent = err.message;
    finderError.hidden = false;
    return;
  }

  const { store, distanceKm } = nearestStore(normalized);
  selectBranch(store);
  finderResult.textContent = `Your nearest branch is ${store.name} (~${distanceKm.toFixed(1)}km away) — selected below.`;
  finderResult.hidden = false;
});

document.getElementById("branch-pickup-button").addEventListener("click", () => {
  order.fulfillment = "pickup";
  showStep(3);
});

document.getElementById("branch-delivery-button").addEventListener("click", () => {
  order.fulfillment = "delivery";
  showStep(3);
});

document.getElementById("branch-support-button").addEventListener("click", () => {
  branchSupportNumber.textContent = `📞 ${order.store.name} branch support: ${order.store.phone} (fake number, does not ring anywhere)`;
  branchSupportNumber.hidden = false;
});

// --- Step 3: pizza selection & cart -----------------------------------------
const pizzaGrid = document.getElementById("pizza-grid");
const pizzaConfigContainer = document.getElementById("pizza-config");
const pizzaCartSummary = document.getElementById("pizza-cart-summary");
const toStep4Button = document.getElementById("to-step-4");
let pizzaConfigState = null;

PIZZAS.forEach((pizza) => {
  const card = document.createElement("div");
  card.className = "pizza-card";
  card.dataset.pizzaId = pizza.id;
  card.innerHTML = `<span class="emoji">${PIZZA_EMOJI[pizza.id] ?? "🍕"}</span>${pizza.name}`;
  card.addEventListener("click", () => selectPizza(pizza));
  pizzaGrid.appendChild(card);
});

function selectPizza(pizza) {
  pizzaConfigState = {
    pizza,
    size: "Small",
    removedBase: new Set(),
    extraToppings: new Set(),
    quantity: 1,
    sauce: "yes",
    cheese: CHEESE_OPTIONS[0],
  };
  Array.from(pizzaGrid.children).forEach((c) => c.classList.toggle("selected", c.dataset.pizzaId === pizza.id));
  renderPizzaConfig();
}

function computePizzaUnitPrice() {
  return calculatePizzaPrice(pizzaConfigState.pizza.id, pizzaConfigState.size, pizzaConfigState.extraToppings.size);
}

function renderPizzaConfig() {
  const { pizza, size, removedBase, extraToppings, quantity, sauce, cheese } = pizzaConfigState;
  const availableExtras = TOPPING_OPTIONS.filter((t) => !pizza.baseToppings.includes(t));
  const unitPrice = computePizzaUnitPrice();
  const lineTotal = unitPrice * quantity;

  pizzaConfigContainer.hidden = false;
  pizzaConfigContainer.innerHTML = `
    <p class="item-description">${pizza.description}</p>
    ${
      pizza.id === "custom"
        ? `
      <fieldset>
        <legend>Sauce</legend>
        <label class="radio-option"><input type="radio" name="cfg-sauce" value="yes" ${
          sauce === "yes" ? "checked" : ""
        }> Yes, tomato sauce please</label>
        <label class="radio-option"><input type="radio" name="cfg-sauce" value="no" ${
          sauce === "no" ? "checked" : ""
        }> No sauce</label>
      </fieldset>
      <fieldset>
        <legend>Cheese</legend>
        ${CHEESE_OPTIONS.map(
          (c) => `<label class="radio-option"><input type="radio" name="cfg-cheese" value="${c}" ${
            cheese === c ? "checked" : ""
          }> ${c}</label>`
        ).join("")}
      </fieldset>
    `
        : ""
    }
    ${
      pizza.baseToppings.length
        ? `
      <fieldset>
        <legend>Included (uncheck to remove)</legend>
        ${pizza.baseToppings
          .map(
            (t) =>
              `<label class="checkbox-option"><input type="checkbox" data-base-topping="${t}" ${
                removedBase.has(t) ? "" : "checked"
              }> ${t}</label>`
          )
          .join("")}
      </fieldset>
    `
        : ""
    }
    <fieldset>
      <legend>Add extra toppings (+${formatGBP(EXTRA_TOPPING_PRICE)} each)</legend>
      ${availableExtras
        .map(
          (t) =>
            `<label class="checkbox-option"><input type="checkbox" data-extra-topping="${t}" ${
              extraToppings.has(t) ? "checked" : ""
            }> ${t}</label>`
        )
        .join("")}
    </fieldset>
    <fieldset>
      <legend>Size</legend>
      ${PIZZA_SIZES.map(
        (s) =>
          `<label class="radio-option"><input type="radio" name="cfg-size" value="${s}" ${
            size === s ? "checked" : ""
          }> ${s} — ${formatGBP(calculatePizzaPrice(pizza.id, s, extraToppings.size))}</label>`
      ).join("")}
    </fieldset>
    <div class="quantity-row">
      <span>Quantity</span>
      <div class="quantity-stepper">
        <button type="button" id="cfg-qty-minus" aria-label="Decrease quantity">−</button>
        <span id="cfg-qty-value">${quantity}</span>
        <button type="button" id="cfg-qty-plus" aria-label="Increase quantity">+</button>
      </div>
    </div>
    <div class="item-total">Line total: <strong>${formatGBP(lineTotal)}</strong></div>
    <div class="step-actions step-actions-center">
      <button type="button" id="add-pizza-to-order">Add to order — ${formatGBP(lineTotal)}</button>
    </div>
  `;

  if (pizza.id === "custom") {
    pizzaConfigContainer.querySelectorAll('input[name="cfg-sauce"]').forEach((r) =>
      r.addEventListener("change", (e) => {
        pizzaConfigState.sauce = e.target.value;
        renderPizzaConfig();
      })
    );
    pizzaConfigContainer.querySelectorAll('input[name="cfg-cheese"]').forEach((r) =>
      r.addEventListener("change", (e) => {
        pizzaConfigState.cheese = e.target.value;
        renderPizzaConfig();
      })
    );
  }
  pizzaConfigContainer.querySelectorAll("input[data-base-topping]").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      const name = e.target.dataset.baseTopping;
      if (e.target.checked) removedBase.delete(name);
      else removedBase.add(name);
      renderPizzaConfig();
    })
  );
  pizzaConfigContainer.querySelectorAll("input[data-extra-topping]").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      const name = e.target.dataset.extraTopping;
      if (e.target.checked) extraToppings.add(name);
      else extraToppings.delete(name);
      renderPizzaConfig();
    })
  );
  pizzaConfigContainer.querySelectorAll('input[name="cfg-size"]').forEach((r) =>
    r.addEventListener("change", (e) => {
      pizzaConfigState.size = e.target.value;
      renderPizzaConfig();
    })
  );
  document.getElementById("cfg-qty-minus").addEventListener("click", () => {
    if (pizzaConfigState.quantity > 1) {
      pizzaConfigState.quantity--;
      renderPizzaConfig();
    }
  });
  document.getElementById("cfg-qty-plus").addEventListener("click", () => {
    pizzaConfigState.quantity++;
    renderPizzaConfig();
  });
  document.getElementById("add-pizza-to-order").addEventListener("click", addPizzaToCart);
}

function addPizzaToCart() {
  const { pizza, size, removedBase, extraToppings, quantity, sauce, cheese } = pizzaConfigState;
  const unitPrice = computePizzaUnitPrice();
  order.cart.pizzas.push({
    pizzaId: pizza.id,
    name: pizza.name,
    size,
    removedBase: Array.from(removedBase),
    extraToppings: Array.from(extraToppings),
    sauce: pizza.id === "custom" ? sauce : undefined,
    cheese: pizza.id === "custom" ? cheese : undefined,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
  });
  pizzaConfigState = null;
  pizzaConfigContainer.hidden = true;
  pizzaConfigContainer.innerHTML = "";
  Array.from(pizzaGrid.children).forEach((c) => c.classList.remove("selected"));
  renderPizzaCartSummary();
}

function renderPizzaCartSummary() {
  toStep4Button.disabled = order.cart.pizzas.length === 0;
  if (!order.cart.pizzas.length) {
    pizzaCartSummary.innerHTML = "";
    return;
  }
  pizzaCartSummary.innerHTML = `
    <h3>Your order so far</h3>
    ${order.cart.pizzas
      .map(
        (item, i) => `
      <div class="cart-line">
        <span>${item.quantity} × ${item.name} (${item.size})${
          item.extraToppings.length ? ` + ${item.extraToppings.join(", ")}` : ""
        }</span>
        <span>${formatGBP(item.lineTotal)} <button type="button" class="remove-line" data-index="${i}">Remove</button></span>
      </div>
    `
      )
      .join("")}
  `;
  pizzaCartSummary.querySelectorAll(".remove-line").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      order.cart.pizzas.splice(Number(e.target.dataset.index), 1);
      renderPizzaCartSummary();
    })
  );
}

document.getElementById("back-to-branch").addEventListener("click", () => showStep(2));
toStep4Button.addEventListener("click", () => showStep(4));

// --- Step 4: drinks & cart ---------------------------------------------
const drinkGrid = document.getElementById("drink-grid");
const drinkConfigContainer = document.getElementById("drink-config");
const drinkCartSummary = document.getElementById("drink-cart-summary");
let drinkConfigState = null;

DRINKS.forEach((drink) => {
  const card = document.createElement("div");
  card.className = "pizza-card";
  card.dataset.drink = drink;
  card.innerHTML = `<span class="emoji">${DRINK_EMOJI[drink] ?? "🥤"}</span>${drink}<br /><small>${formatGBP(
    DRINK_PRICE
  )}</small>`;
  card.addEventListener("click", () => selectDrink(drink));
  drinkGrid.appendChild(card);
});

function selectDrink(drink) {
  drinkConfigState = { drink, quantity: 1 };
  Array.from(drinkGrid.children).forEach((c) => c.classList.toggle("selected", c.dataset.drink === drink));
  renderDrinkConfig();
}

function renderDrinkConfig() {
  const { drink, quantity } = drinkConfigState;
  const lineTotal = DRINK_PRICE * quantity;
  drinkConfigContainer.hidden = false;
  drinkConfigContainer.innerHTML = `
    <div class="quantity-row">
      <span>Quantity of ${drink}</span>
      <div class="quantity-stepper">
        <button type="button" id="drink-qty-minus" aria-label="Decrease quantity">−</button>
        <span>${quantity}</span>
        <button type="button" id="drink-qty-plus" aria-label="Increase quantity">+</button>
      </div>
    </div>
    <div class="item-total">Line total: <strong>${formatGBP(lineTotal)}</strong></div>
    <div class="step-actions step-actions-center">
      <button type="button" id="add-drink-to-order">Add to order — ${formatGBP(lineTotal)}</button>
    </div>
  `;
  document.getElementById("drink-qty-minus").addEventListener("click", () => {
    if (drinkConfigState.quantity > 1) {
      drinkConfigState.quantity--;
      renderDrinkConfig();
    }
  });
  document.getElementById("drink-qty-plus").addEventListener("click", () => {
    drinkConfigState.quantity++;
    renderDrinkConfig();
  });
  document.getElementById("add-drink-to-order").addEventListener("click", addDrinkToCart);
}

function addDrinkToCart() {
  const { drink, quantity } = drinkConfigState;
  order.cart.drinks.push({ drink, quantity, unitPrice: DRINK_PRICE, lineTotal: DRINK_PRICE * quantity });
  drinkConfigState = null;
  drinkConfigContainer.hidden = true;
  drinkConfigContainer.innerHTML = "";
  Array.from(drinkGrid.children).forEach((c) => c.classList.remove("selected"));
  renderDrinkCartSummary();
}

function renderDrinkCartSummary() {
  if (!order.cart.drinks.length) {
    drinkCartSummary.innerHTML = "";
    return;
  }
  drinkCartSummary.innerHTML = `
    <h3>Your drinks so far</h3>
    ${order.cart.drinks
      .map(
        (item, i) => `
      <div class="cart-line">
        <span>${item.quantity} × ${item.drink}</span>
        <span>${formatGBP(item.lineTotal)} <button type="button" class="remove-line" data-index="${i}">Remove</button></span>
      </div>
    `
      )
      .join("")}
  `;
  drinkCartSummary.querySelectorAll(".remove-line").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      order.cart.drinks.splice(Number(e.target.dataset.index), 1);
      renderDrinkCartSummary();
    })
  );
}

document.getElementById("back-to-pizza").addEventListener("click", () => showStep(3));

// --- Step 5: customer details --------------------------------------------
const detailsForm = document.getElementById("details-form");
const detailsError = document.getElementById("details-error");
const deliveryFields = document.getElementById("delivery-fields");
const pickupNote = document.getElementById("pickup-note");

document.getElementById("to-step-5").addEventListener("click", () => {
  const isDelivery = order.fulfillment === "delivery";
  deliveryFields.hidden = !isDelivery;
  pickupNote.hidden = isDelivery;
  showStep(5);
});

document.getElementById("back-to-drinks").addEventListener("click", () => showStep(4));

detailsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  detailsError.hidden = true;

  const name = document.getElementById("customer-name").value.trim();
  if (!name) {
    return showDetailsError("Please enter your name.");
  }
  order.name = name;

  if (order.fulfillment === "delivery") {
    const address = document.getElementById("customer-address").value.trim();
    const postcodeRaw = document.getElementById("customer-postcode").value.trim();
    if (!address) {
      return showDetailsError("Please enter your delivery address.");
    }
    try {
      order.postcode = validateLondonPostcode(postcodeRaw);
    } catch (err) {
      return showDetailsError(err.message);
    }
    order.address = address;
  }

  renderEstimateStep();
  showStep(6);
});

function showDetailsError(message) {
  detailsError.textContent = message;
  detailsError.hidden = false;
}

// --- Step 6: time estimate --------------------------------------------------
function renderEstimateStep() {
  const heading = document.getElementById("estimate-heading");
  const detail = document.getElementById("estimate-detail");
  if (order.fulfillment === "pickup") {
    heading.textContent = "We're getting your pizza ready!";
    detail.textContent = `Ready for pickup in approximately ${PREP_MINUTES} minutes at Marubel Pizza's, ${order.store.name}. Just give the name "${order.name}" at the counter.`;
  } else {
    const location = fakeGeocode(order.postcode);
    const distanceKm = haversineKm(location.lat, location.lon, order.store.lat, order.store.lon);
    order.deliveryMinutes = estimateDeliveryMinutes(distanceKm);
    heading.textContent = "Your order is on its way!";
    detail.textContent = `Estimated delivery time: approximately ${order.deliveryMinutes} minutes to ${order.address}, ${order.postcode}.`;
  }
}

document.getElementById("back-to-details").addEventListener("click", () => showStep(5));
document.getElementById("to-step-7").addEventListener("click", () => {
  renderReceipt();
  showStep(7);
});

// --- Step 7: receipt ---------------------------------------------------
function renderReceipt() {
  const pizzaSubtotal = order.cart.pizzas.reduce((sum, i) => sum + i.lineTotal, 0);
  const drinksSubtotal = order.cart.drinks.reduce((sum, i) => sum + i.lineTotal, 0);
  const subtotal = pizzaSubtotal + drinksSubtotal;
  const deliveryFee = order.fulfillment === "delivery" ? DELIVERY_FEE : 0;
  order.total = subtotal + deliveryFee;

  const pizzaLines = order.cart.pizzas
    .map(
      (item) => `
    <div class="receipt-line">
      <span>${item.quantity}x ${item.name} (${item.size})</span>
      <span>${formatGBP(item.lineTotal)}</span>
    </div>
    ${item.extraToppings.length ? `<div class="receipt-subline">+ ${item.extraToppings.join(", ")}</div>` : ""}
    ${item.removedBase.length ? `<div class="receipt-subline">no ${item.removedBase.join(", ")}</div>` : ""}
  `
    )
    .join("");

  const drinkLines = order.cart.drinks
    .map(
      (item) => `
    <div class="receipt-line">
      <span>${item.quantity}x ${item.drink}</span>
      <span>${formatGBP(item.lineTotal)}</span>
    </div>
  `
    )
    .join("");

  document.getElementById("receipt-content").innerHTML = `
    <div class="receipt-header">
      <div class="receipt-store">MARUBEL PIZZA'S</div>
      <div>${order.store.name} branch</div>
      <div class="receipt-type">${order.fulfillment === "delivery" ? "DELIVERY ORDER" : "PICKUP ORDER"}</div>
    </div>
    <div class="receipt-divider"></div>
    ${pizzaLines}
    ${drinkLines}
    <div class="receipt-divider"></div>
    <div class="receipt-line"><span>Subtotal</span><span>${formatGBP(subtotal)}</span></div>
    <div class="receipt-line"><span>${order.fulfillment === "delivery" ? "Delivery fee" : "Pickup"}</span><span>${
      order.fulfillment === "delivery" ? formatGBP(DELIVERY_FEE) : "FREE"
    }</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-line receipt-total"><span>TOTAL</span><span>${formatGBP(order.total)}</span></div>
    <div class="receipt-footer">Thank you for choosing<br />Marubel Pizza's! 🍕</div>
  `;
}

document.getElementById("to-step-8").addEventListener("click", () => showStep(8));

// --- Step 8: payment (fake) ------------------------------------------------
const paymentForm = document.getElementById("payment-form");

document.getElementById("back-to-receipt").addEventListener("click", () => showStep(7));

paymentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  completeOrder();
});

// --- Step 9: confirmation --------------------------------------------------
const confirmationContent = document.getElementById("confirmation-content");

function completeOrder() {
  if (order.fulfillment === "pickup") {
    confirmationContent.innerHTML = `
      <p>Thanks, ${escapeHtml(order.name)} — your order is confirmed!</p>
      <p><strong>Pickup from:</strong> Marubel Pizza's, ${order.store.name}</p>
      <p><strong>Ready in:</strong> approximately ${PREP_MINUTES} minutes</p>
      <p><strong>Total paid:</strong> <span class="highlight">${formatGBP(order.total)}</span></p>
      <p>Give the name "${escapeHtml(order.name)}" at the counter. Have a great day! 🍕</p>
    `;
  } else {
    const driver = assignDriver();
    confirmationContent.innerHTML = `
      <p>Thanks, ${escapeHtml(order.name)} — your order is on its way!</p>
      <p><strong>Delivering to:</strong> ${escapeHtml(order.address)}, ${escapeHtml(order.postcode)}</p>
      <p><strong>Ordering from:</strong> Marubel Pizza's, ${order.store.name}</p>
      <p><strong>Delivery driver:</strong> ${driver}</p>
      <p><strong>Estimated delivery time:</strong> <span class="highlight">~${order.deliveryMinutes} minutes</span></p>
      <p><strong>Total paid:</strong> <span class="highlight">${formatGBP(order.total)}</span></p>
      <p>Have a great day! 🍕</p>
    `;
  }
  showStep(9);
}

// --- Start over --------------------------------------------------------
document.getElementById("start-over").addEventListener("click", () => {
  window.location.reload();
});

showStep(1);
