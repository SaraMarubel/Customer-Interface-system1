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

// A soft, stylised river Thames line — not a real map, just visual flavour.
const RIVER_PATH =
  "M 0 190 C 60 180, 90 210, 140 195 S 220 165, 260 185 S 340 210, 400 195";

branchMap.innerHTML = `
  <rect x="0" y="0" width="400" height="300" class="map-background" rx="16" />
  <path d="${RIVER_PATH}" class="map-river" />
`;

const pinGroups = new Map();
STORES.forEach((store) => {
  const { xFraction, yFraction } = projectToMapFraction(store.lat, store.lon);
  const x = xFraction * 400;
  const y = yFraction * 300;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "map-pin");
  group.setAttribute("tabindex", "0");
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", `Select ${store.name} branch`);
  group.innerHTML = `
    <circle cx="${x}" cy="${y}" r="9" />
    <text x="${x}" y="${y + 22}" text-anchor="middle">${store.name}</text>
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
