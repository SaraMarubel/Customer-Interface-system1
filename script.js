import {
  PIZZA_MENU,
  CHEESE_OPTIONS,
  TOPPING_OPTIONS,
  validateLondonPostcode,
  isValidCardNumber,
  isValidExpiry,
  isValidCvv,
  nearestStore,
  estimateDeliveryMinutes,
  assignDriver,
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

// --- Step 1: pizza selection -------------------------------------------
const pizzaGrid = document.getElementById("pizza-grid");
const toStep2Button = document.getElementById("to-step-2");

PIZZA_MENU.forEach((pizza) => {
  const card = document.createElement("div");
  card.className = "pizza-card";
  card.dataset.pizza = pizza;
  card.innerHTML = `<span class="emoji">${PIZZA_EMOJI[pizza] ?? "🍕"}</span>${pizza}`;
  card.addEventListener("click", () => {
    order.pizza = pizza;
    Array.from(pizzaGrid.children).forEach((c) => c.classList.toggle("selected", c === card));
    toStep2Button.disabled = false;
  });
  pizzaGrid.appendChild(card);
});

toStep2Button.addEventListener("click", () => {
  if (order.pizza === "Custom") {
    showStep(2);
  } else {
    showStep(3);
  }
});

// --- Step 2: customize (only for Custom pizza) --------------------------
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

document.getElementById("back-to-step-1").addEventListener("click", () => showStep(1));

document.getElementById("to-step-3").addEventListener("click", () => {
  if (!order.cheese) {
    order.cheese = CHEESE_OPTIONS[0];
    cheeseOptionsContainer.querySelector("input").checked = true;
  }
  showStep(3);
});

// --- Step 3: customer details --------------------------------------------
const detailsForm = document.getElementById("details-form");
const detailsError = document.getElementById("details-error");

document.getElementById("back-to-pizza").addEventListener("click", () => {
  showStep(order.pizza === "Custom" ? 2 : 1);
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
  showStep(4);
});

function showDetailsError(message) {
  detailsError.textContent = message;
  detailsError.hidden = false;
}

// --- Step 4: payment (fake) ------------------------------------------------
const paymentForm = document.getElementById("payment-form");
const paymentError = document.getElementById("payment-error");

document.getElementById("back-to-details").addEventListener("click", () => showStep(3));

paymentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  paymentError.hidden = true;

  const cardNumber = document.getElementById("card-number").value;
  const cardExpiry = document.getElementById("card-expiry").value;
  const cardCvv = document.getElementById("card-cvv").value;

  if (!isValidCardNumber(cardNumber)) {
    return showPaymentError("That card number doesn't look valid (check the digits).");
  }
  if (!isValidExpiry(cardExpiry)) {
    return showPaymentError("Enter a valid, non-expired expiry date as MM/YY.");
  }
  if (!isValidCvv(cardCvv)) {
    return showPaymentError("CVV must be exactly 3 digits.");
  }

  completeOrder();
});

function showPaymentError(message) {
  paymentError.textContent = message;
  paymentError.hidden = false;
}

// --- Step 5: confirmation --------------------------------------------------
const confirmationContent = document.getElementById("confirmation-content");

function completeOrder() {
  const { store, distanceKm } = nearestStore(order.postcode);
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
    <p><strong>Nearest pizzeria:</strong> Marubel Pizza's, ${store.name}</p>
    <p><strong>Delivery driver:</strong> ${driver}</p>
    <p><strong>Prep time:</strong> roughly ${PREP_MINUTES} minutes</p>
    <p><strong>Estimated delivery time:</strong> <span class="highlight">~${totalMinutes} minutes</span></p>
    <p>Have a great day! 🍕</p>
  `;
  showStep(5);
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
