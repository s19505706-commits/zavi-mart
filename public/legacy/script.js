const products = [
  {
    id: 1,
    name: "Samsung Galaxy A35 5G",
    category: "mobiles",
    price: 74999,
    oldPrice: 85999,
    rating: 4.8,
    badge: "Top rated",
    brand: "Samsung",
    delivery: "Free delivery in 2-4 days",
    description:
      "6.6-inch AMOLED display, 5G connectivity, and strong all-day battery performance for everyday convenience and entertainment.",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 2,
    name: "Khaadi Lawn Printed Set",
    category: "fashion",
    price: 4999,
    oldPrice: 6299,
    rating: 4.7,
    badge: "New arrival",
    brand: "Khaadi",
    delivery: "Cash on delivery available",
    description:
      "Lightweight premium lawn fabric with vibrant seasonal prints designed for comfort, elegance and practicality.",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 3,
    name: "Braun Air Fryer 4.2L",
    category: "home",
    price: 28999,
    oldPrice: 34999,
    rating: 4.9,
    badge: "Hot deal",
    brand: "Braun",
    delivery: "Free shipping across Pakistan",
    description:
      "Healthy cooking with rapid air circulation, easy controls and a compact form that fits busy kitchens and family routines.",
    image:
      "https://images.unsplash.com/photo-1585518419759-7fe2e0fbf8a9?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 4,
    name: "Hydrating Face Serum",
    category: "beauty",
    price: 2499,
    oldPrice: 3299,
    rating: 4.8,
    badge: "Bestseller",
    brand: "Glow Lab",
    delivery: "Fast delivery in 48 hours",
    description:
      "A lightweight serum with niacinamide and hyaluronic acid to brighten, hydrate and support a healthy skin routine.",
    image:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 5,
    name: "AirPods Pro 2",
    category: "electronics",
    price: 57999,
    oldPrice: 64999,
    rating: 4.9,
    badge: "Limited stock",
    brand: "Apple",
    delivery: "Free delivery • 1-year warranty",
    description:
      "Premium wireless audio with improved noise cancellation, rich sound and effortless volume control for daily listening.",
    image:
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 6,
    name: "Premium Cotton Bedsheet Set",
    category: "home",
    price: 3999,
    oldPrice: 4799,
    rating: 4.6,
    badge: "Value pick",
    brand: "HomeNest",
    delivery: "Available for COD",
    description:
      "Soft comfort and a crisp finish for a refreshed bedroom experience with easy-care fabric and modern tones.",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 7,
    name: "Dettol Hygiene Kit",
    category: "health",
    price: 1599,
    oldPrice: 2199,
    rating: 4.7,
    badge: "Recommended",
    brand: "Dettol",
    delivery: "Exclusive online price",
    description:
      "A complete hygiene and wellness bundle helping families maintain fresh and protected routines at home.",
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 8,
    name: "Haier 8kg Washing Machine",
    category: "appliances",
    price: 69999,
    oldPrice: 81999,
    rating: 4.8,
    badge: "Best value",
    brand: "Haier",
    delivery: "Installation available",
    description:
      "Energy-efficient washing performance and smart fabric care designed to simplify household routines and reduce effort.",
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 9,
    name: "iPhone 15 Pro",
    category: "mobiles",
    price: 419999,
    oldPrice: 469999,
    rating: 4.9,
    badge: "Premium pick",
    brand: "Apple",
    delivery: "Free delivery + Apple care available",
    description:
      "Advanced camera system, titanium finish, and a smooth all-day experience for users who want premium performance and style.",
    image:
      "https://images.unsplash.com/photo-1671725778650-7b7d58c5b355?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 10,
    name: "HP Pavilion 14 Laptop",
    category: "electronics",
    price: 179999,
    oldPrice: 209999,
    rating: 4.7,
    badge: "Work from home",
    brand: "HP",
    delivery: "Nationwide shipping in 3-5 days",
    description:
      "Slim, lightweight performance laptop with crisp display and reliable multitasking power for study, work and entertainment.",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 11,
    name: "Nike Air Max Runner",
    category: "fashion",
    price: 8999,
    oldPrice: 11999,
    rating: 4.6,
    badge: "Trending",
    brand: "Nike",
    delivery: "Easy return available",
    description:
      "A sporty silhouette with responsive cushioning and everyday comfort for walking, workouts and casual styling.",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 12,
    name: "Golden Basmati Rice 10kg",
    category: "groceries",
    price: 2999,
    oldPrice: 3899,
    rating: 4.8,
    badge: "Family pack",
    brand: "Safa",
    delivery: "Fresh stock • COD available",
    description:
      "Long-grain aromatic rice crafted for everyday meals, family dinners and authentic Pakistani cooking traditions.",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 13,
    name: "Philips Beard Trimmer",
    category: "health",
    price: 6999,
    oldPrice: 8999,
    rating: 4.7,
    badge: "Everyday essential",
    brand: "Philips",
    delivery: "Fast delivery in 48 hours",
    description:
      "Precision grooming with easy trimming control, cordless comfort and a travel-friendly design for quick daily routines.",
    image:
      "https://images.unsplash.com/photo-1521590832167-7e9d2f5d8f6a?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 14,
    name: "Hisense 1.5 Ton Inverter AC",
    category: "appliances",
    price: 129999,
    oldPrice: 149999,
    rating: 4.8,
    badge: "Cooling deal",
    brand: "Hisense",
    delivery: "Free installation included",
    description:
      "Energy-saving cooling with quiet airflow, smart control and dependable comfort for homes and offices during hot weather.",
    image:
      "https://images.unsplash.com/photo-1584269600460-8c56d8834f60?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 15,
    name: "Anker 20W USB-C Fast Charger",
    category: "mobile accessories",
    price: 4999,
    oldPrice: 6499,
    rating: 4.8,
    badge: "Fast charging",
    brand: "Anker",
    delivery: "Free delivery in 2-4 days",
    description: "A compact USB-C wall charger for fast, dependable charging at home or on the go.",
    image:
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 16,
    name: "Magnetic Phone Case",
    category: "mobile accessories",
    price: 1999,
    oldPrice: 2799,
    rating: 4.6,
    badge: "Everyday protection",
    brand: "CaseMate",
    delivery: "Cash on delivery available",
    description: "A slim shock-resistant phone case with a secure magnetic ring and raised camera protection.",
    image:
      "https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 17,
    name: "JBL Portable Bluetooth Speaker",
    category: "electronics",
    price: 14999,
    oldPrice: 17999,
    rating: 4.8,
    badge: "Popular pick",
    brand: "JBL",
    delivery: "Free delivery in 2-4 days",
    description: "A portable wireless speaker with clear sound, simple Bluetooth pairing and a rechargeable battery.",
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 18,
    name: "Smart Fitness Watch",
    category: "electronics",
    price: 11999,
    oldPrice: 15999,
    rating: 4.5,
    badge: "Daily smart tech",
    brand: "FitPro",
    delivery: "Nationwide shipping in 3-5 days",
    description: "Track daily activity, check notifications and monitor your routine from a bright wrist display.",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 19,
    name: "Classic Denim Jacket",
    category: "fashion",
    price: 6499,
    oldPrice: 7999,
    rating: 4.6,
    badge: "Seasonal style",
    brand: "Urban Thread",
    delivery: "Easy return available",
    description: "A versatile denim layer with a comfortable fit for casual outfits throughout the year.",
    image:
      "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 20,
    name: "Everyday Crossbody Bag",
    category: "fashion",
    price: 3499,
    oldPrice: 4499,
    rating: 4.5,
    badge: "New season",
    brand: "Luna",
    delivery: "Cash on delivery available",
    description: "A lightweight crossbody bag with practical compartments for everyday essentials.",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 21,
    name: "Nonstick Cookware Set",
    category: "home",
    price: 9999,
    oldPrice: 12999,
    rating: 4.7,
    badge: "Kitchen essential",
    brand: "KitchenPro",
    delivery: "Free shipping across Pakistan",
    description: "A durable nonstick cookware set for preparing everyday meals with easier cleanup.",
    image:
      "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 22,
    name: "Decorative Table Lamp",
    category: "home",
    price: 4999,
    oldPrice: 6499,
    rating: 4.6,
    badge: "Home refresh",
    brand: "HomeNest",
    delivery: "Nationwide shipping in 3-5 days",
    description: "A warm bedside lamp with a clean design to add practical lighting to living spaces.",
    image:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 23,
    name: "Daily Moisturizing Cream",
    category: "beauty",
    price: 1899,
    oldPrice: 2499,
    rating: 4.7,
    badge: "Skin care favorite",
    brand: "Glow Lab",
    delivery: "Fast delivery in 48 hours",
    description: "A lightweight daily moisturizer designed to leave skin feeling soft and hydrated.",
    image:
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 24,
    name: "Everyday Sunscreen SPF 50",
    category: "beauty",
    price: 1599,
    oldPrice: 1999,
    rating: 4.6,
    badge: "Daily care",
    brand: "SunCare",
    delivery: "Cash on delivery available",
    description: "A lightweight broad-spectrum sunscreen for daily outdoor and commute routines.",
    image:
      "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 25,
    name: "Premium Green Tea 100 Bags",
    category: "groceries",
    price: 899,
    oldPrice: 1199,
    rating: 4.7,
    badge: "Pantry pick",
    brand: "Safa",
    delivery: "Fresh stock • COD available",
    description: "A box of individually wrapped green tea bags for a light, refreshing everyday drink.",
    image:
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 26,
    name: "Extra Virgin Olive Oil 1L",
    category: "groceries",
    price: 3299,
    oldPrice: 3999,
    rating: 4.8,
    badge: "Kitchen staple",
    brand: "Safa",
    delivery: "Fresh stock • COD available",
    description: "A versatile extra virgin olive oil for dressings, cooking and everyday meal preparation.",
    image:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 27,
    name: "Philips 500W Blender",
    category: "appliances",
    price: 10999,
    oldPrice: 13999,
    rating: 4.7,
    badge: "Kitchen deal",
    brand: "Philips",
    delivery: "Free delivery in 2-4 days",
    description: "A compact countertop blender for smoothies, sauces and everyday kitchen preparation.",
    image:
      "https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 28,
    name: "Cordless Stick Vacuum",
    category: "appliances",
    price: 24999,
    oldPrice: 29999,
    rating: 4.6,
    badge: "Easy cleaning",
    brand: "HomeTech",
    delivery: "Nationwide shipping in 3-5 days",
    description: "A lightweight cordless vacuum for quick cleanups across floors, rugs and tight spaces.",
    image:
      "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 29,
    name: "Digital Blood Pressure Monitor",
    category: "health",
    price: 5999,
    oldPrice: 7499,
    rating: 4.8,
    badge: "Wellness essential",
    brand: "CarePlus",
    delivery: "Free delivery in 2-4 days",
    description: "A simple upper-arm blood pressure monitor with a clear digital display for home use.",
    image:
      "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: 30,
    name: "First Aid Kit 80-Piece",
    category: "health",
    price: 2499,
    oldPrice: 3299,
    rating: 4.7,
    badge: "Home safety",
    brand: "CarePlus",
    delivery: "Cash on delivery available",
    description: "A practical first aid kit with everyday essentials for home, travel or the car.",
    image:
      "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=900&q=80"
  }
];

const STORAGE_KEY = "zavimart-cart";
const WISHLIST_STORAGE_KEY = "zavimart-wishlist";
const PENDING_ORDER_SUMMARY_KEY = "zavimart-pending-order-summary";
const WHATSAPP_RECIPIENT = "923074876818";
const checkoutCouponCode = new URLSearchParams(window.location.search).get("coupon")?.trim().toUpperCase() || "";

const state = {
  cart: loadCart(),
  wishlist: loadWishlist(),
  wishlistOnly: false,
  activeCategory: ""
};
let shippingSettings = {
  freeDeliveryEnabled: true,
  minAmountForFree: 1999,
  shippingFee: 149,
  bannerText: "Free Delivery on orders above Rs 1999",
  updatedAt: ""
};
let shippingSettingsLoading = false;
let shippingSettingsError = "";

function formatPrice(value) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0
  }).format(value);
}

function createOrderSummary(order) {
  const itemLines = order.items.map((item) => {
    const product = products.find((entry) => entry.id === Number(item.id));
    const name = product ? product.name : `Product ${item.id}`;
    return `- ${name} x ${item.quantity}`;
  });
  const address = [order.customer.address, order.customer.city].filter(Boolean).join(", ");
  const amount = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(order.amount);
  const message = [
    "🛒 *New Order - ZaviMart*",
    `Order No: *${order.orderId}*`,
    `Customer: ${order.customer.name}`,
    `Mobile: ${order.customer.phone}`,
    `Address: ${address}`,
    `Items:\n${itemLines.join("\n")}`,
    `Total: Rs ${amount}`,
    `Payment: ${order.paymentMethod === "cod" ? "COD" : order.paymentMethod}`
  ].filter(Boolean).join("\n");

  return `https://wa.me/${WHATSAPP_RECIPIENT}?text=${encodeURIComponent(message)}`;
}

function openWhatsAppOrderSummary(order, openedWindow, fallbackLink, statusNote) {
  if (order.whatsappNotificationSent) {
    if (openedWindow && !openedWindow.closed) openedWindow.close();
    return;
  }

  const whatsappUrl = createOrderSummary(order);
  if (openedWindow && !openedWindow.closed) {
    openedWindow.location.href = whatsappUrl;
  }

  if (fallbackLink) {
    fallbackLink.href = whatsappUrl;
    fallbackLink.hidden = false;
    if (statusNote) {
      statusNote.textContent = "Your order summary is ready in WhatsApp. Review the draft and tap Send.";
      statusNote.hidden = false;
    }
  }
}

function getPaymentErrorMessage(error) {
  if (error instanceof TypeError) {
    return window.location.protocol === "file:"
      ? "Payment needs the running store server. Start the server and try again."
      : "The payment server could not be reached. Make sure the store server is running.";
  }
  return error.message || "Could not connect to the payment service. Please try again.";
}

function loadCart() {
  try {
    const params = new URLSearchParams(window.location.search);
    const importedCart = params.get("cart");
    if (window.location.pathname.endsWith("/checkout.html") && importedCart) {
      const parsed = JSON.parse(importedCart);
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 40) return [];
      const importedItems = parsed.map((item) => ({
        id: Number(item?.id),
        quantity: Number(item?.quantity)
      }));
      if (importedItems.some((item) =>
        !products.some((product) => product.id === item.id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      )) return [];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(importedItems));
      params.delete("cart");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      return importedItems;
    }

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
}

function loadWishlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.map(Number).filter(Number.isInteger) : [];
  } catch (error) {
    return [];
  }
}

function saveWishlist() {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(state.wishlist));
}

const productGrid = document.getElementById("productGrid");
const searchInput = document.querySelector(".search-box input");
const searchButton = document.querySelector(".search-box button");
const cartCount = document.getElementById("cartCount");
const wishlistButton = document.getElementById("wishlistButton");
const wishlistCount = document.getElementById("wishlistCount");
const newsletterForm = document.getElementById("newsletterForm");
const returnRequestForm = document.getElementById("returnRequestForm");
const returnRequestStatus = document.getElementById("returnRequestStatus");
const cartButton = document.getElementById("cartButton");
const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const subtotalValue = document.getElementById("subtotalValue");
const loginButton = document.querySelector(".header-login");
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const closeLoginModal = document.getElementById("closeLoginModal");
const modalOverlay = document.getElementById("modalOverlay");
const productModal = document.getElementById("productModal");
const modalContent = document.getElementById("modalContent");
const closeModal = document.getElementById("closeModal");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutDiscountRow = document.getElementById("checkoutDiscountRow");
const checkoutDiscount = document.getElementById("checkoutDiscount");
const checkoutShipping = document.getElementById("checkoutShipping");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutEmpty = document.getElementById("checkoutEmpty");
const checkoutError = document.getElementById("checkoutError");
const checkoutButton = document.querySelector(".checkout-btn");
const paymentStatus = document.getElementById("paymentStatus");
const paymentMethod = document.getElementById("paymentMethod");
const safepayOption = paymentMethod?.querySelector("option[value='safepay']");
const easypaisaOption = paymentMethod?.querySelector("option[value='easypaisa']");
const codOption = paymentMethod?.querySelector("option[value='cod']");
const easypaisaPanel = document.getElementById("easypaisaPanel");
const easypaisaInstructions = document.getElementById("easypaisaInstructions");
const easypaisaAccount = document.getElementById("easypaisaAccount");
const easypaisaReferenceForm = document.getElementById("easypaisaReferenceForm");
const easypaisaError = document.getElementById("easypaisaError");
const easypaisaSubmitted = document.getElementById("easypaisaSubmitted");
const copyEasypaisaAccount = document.getElementById("copyEasypaisaAccount");
const easypaisaWhatsAppLink = document.getElementById("easypaisaWhatsAppLink");
const easypaisaWhatsAppNote = document.getElementById("easypaisaWhatsAppNote");
const codPanel = document.getElementById("codPanel");
const codConfirmation = document.getElementById("codConfirmation");
const codWhatsAppLink = document.getElementById("codWhatsAppLink");
const codWhatsAppNote = document.getElementById("codWhatsAppNote");
const paymentWhatsAppLink = document.getElementById("paymentWhatsAppLink");
const paymentWhatsAppNote = document.getElementById("paymentWhatsAppNote");
const deliveryMapContainer = document.getElementById("deliveryMap");
const locateAddressButton = document.getElementById("locateAddressButton");
const mapStatus = document.getElementById("mapStatus");
const deliveryLatitude = document.getElementById("deliveryLatitude");
const deliveryLongitude = document.getElementById("deliveryLongitude");
let easypaisaOrderId = null;
let easypaisaOrderSummary = null;
let deliveryMap = null;
let deliveryMarker = null;
let addressLookupTimer = null;

function setMapStatus(message, status = "") {
  if (!mapStatus) return;
  mapStatus.textContent = message;
  mapStatus.dataset.state = status;
}

function showServerRequiredMapMessage() {
  if (locateAddressButton) {
    locateAddressButton.disabled = true;
    locateAddressButton.title = "Open the store through its running server to enable address lookup";
  }
  setMapStatus("Open the store through its running server to use the delivery map and address lookup.", "error");
}

function setDeliveryCoordinates(latitude, longitude, message) {
  if (!deliveryMap || !window.L) return;
  const position = [latitude, longitude];
  if (!deliveryMarker) {
    deliveryMarker = window.L.marker(position, { draggable: true }).addTo(deliveryMap);
    deliveryMarker.on("dragend", () => {
      const updatedPosition = deliveryMarker.getLatLng();
      setDeliveryCoordinates(updatedPosition.lat, updatedPosition.lng, "Pin location selected. Coordinates will be saved with your order.");
    });
  } else {
    deliveryMarker.setLatLng(position);
  }

  deliveryLatitude.value = latitude.toFixed(6);
  deliveryLongitude.value = longitude.toFixed(6);
  deliveryMap.setView(position, 17);
  setMapStatus(message, "success");
}

function initializeDeliveryMap() {
  if (window.location.protocol === "file:") {
    showServerRequiredMapMessage();
    return;
  }

  if (!deliveryMapContainer || !window.L) return;

  deliveryMap = window.L.map(deliveryMapContainer, { scrollWheelZoom: false }).setView([30.3753, 69.3451], 5);
  window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: 'Tiles © Esri'
  }).addTo(deliveryMap);
  deliveryMap.on("click", (event) => {
    setDeliveryCoordinates(event.latlng.lat, event.latlng.lng, "Pin location selected. Coordinates will be saved with your order.");
  });

  const addressFields = [
    checkoutForm?.elements.namedItem("address"),
    checkoutForm?.elements.namedItem("city"),
    checkoutForm?.elements.namedItem("zip")
  ].filter(Boolean);

  const scheduleAddressLookup = () => {
    clearTimeout(addressLookupTimer);
    const street = checkoutForm?.elements.namedItem("address")?.value.trim() || "";
    const city = checkoutForm?.elements.namedItem("city")?.value.trim() || "";
    const postalCode = checkoutForm?.elements.namedItem("zip")?.value.trim() || "";

    if (!street || !city || !postalCode) {
      setMapStatus("Enter your street address, city, and postal code to locate the map.", "error");
      return;
    }

    addressLookupTimer = setTimeout(() => {
      if (locateAddressButton) {
        locateAddressButton.click();
      }
    }, 600);
  };

  addressFields.forEach((field) => {
    const onAddressChange = () => {
      deliveryLatitude.value = "";
      deliveryLongitude.value = "";
      if (deliveryMarker) {
        deliveryMap.removeLayer(deliveryMarker);
        deliveryMarker = null;
      }
      setMapStatus("Address changed. Searching for the delivery pin...");
      scheduleAddressLookup();
    };
    field.addEventListener("input", onAddressChange);
    field.addEventListener("change", onAddressChange);
  });
}

if (locateAddressButton && checkoutForm && deliveryLatitude && deliveryLongitude) {
  initializeDeliveryMap();
  locateAddressButton.addEventListener("click", async () => {
    if (window.location.protocol === "file:") {
      showServerRequiredMapMessage();
      return;
    }

    const street = checkoutForm.elements.namedItem("address").value.trim();
    const city = checkoutForm.elements.namedItem("city").value.trim();
    const postalCode = checkoutForm.elements.namedItem("zip").value.trim();
    if (!street || !city || !postalCode) {
      setMapStatus("Enter your street address, city, and postal code first.", "error");
      return;
    }

    locateAddressButton.disabled = true;
    locateAddressButton.textContent = "Locating...";
    setMapStatus("Searching OpenStreetMap for this address...");
    try {
      const query = `${street}, ${city}, ${postalCode}, Pakistan`;
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Address lookup failed.");
      if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
        throw new Error("No matching address was found. Try a nearby landmark or select the pin manually.");
      }
      setDeliveryCoordinates(result.latitude, result.longitude, `Address located: ${result.displayName}. Drag the pin to adjust it.`);
    } catch (error) {
      const message = error instanceof TypeError
        ? "Open the store through its running server so the map can reach the address lookup service."
        : error.message || "Could not locate this address. Try again or select a pin manually.";
      setMapStatus(message, "error");
    } finally {
      locateAddressButton.disabled = false;
      locateAddressButton.textContent = "Locate address";
    }
  });
}

async function configurePaymentMethods() {
  if (!paymentMethod) return;

  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("Payment service unavailable.");
    const health = await response.json();

    if (safepayOption && !health.paymentProviderConfigured) {
      safepayOption.disabled = true;
      safepayOption.textContent = "Safepay (merchant setup required)";
    }
    if (easypaisaOption && !health.easypaisaConfigured) {
      easypaisaOption.disabled = true;
      easypaisaOption.textContent = "Easypaisa (not configured)";
    }
    if (codOption && !health.cashOnDeliveryAvailable) {
      codOption.disabled = true;
      codOption.textContent = "Cash on Delivery (unavailable)";
    }

    if (paymentMethod.value === "safepay" && safepayOption?.disabled && !easypaisaOption?.disabled) {
      paymentMethod.value = "easypaisa";
    }
  } catch (error) {
    if (paymentMethod.value === "safepay") paymentMethod.value = "easypaisa";
  }
}

function updatePaymentButtonLabel() {
  const button = checkoutForm?.querySelector("button[type='submit']");
  if (!button) return;
  button.textContent = paymentMethod?.value === "easypaisa"
    ? "Continue with Easypaisa"
    : paymentMethod?.value === "cod"
      ? "Place COD order"
      : "Continue to Safepay";
  button.disabled = shippingSettingsLoading || Boolean(shippingSettingsError) ||
    !paymentMethod?.value || Boolean(paymentMethod.selectedOptions[0]?.disabled);
}

function getCartCount() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getSubtotal() {
  return state.cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
}

async function loadShippingSettings() {
  shippingSettingsLoading = true;
  updatePaymentButtonLabel();
  try {
    const response = await fetch("/api/shipping", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok ||
        typeof result?.freeDeliveryEnabled !== "boolean" ||
        typeof result?.minAmountForFree !== "number" ||
        typeof result?.shippingFee !== "number" ||
        typeof result?.bannerText !== "string" ||
        typeof result?.updatedAt !== "string") {
      throw new Error(result?.error || "Could not load delivery settings.");
    }
    shippingSettings = result;
    shippingSettingsError = "";
  } catch (error) {
    shippingSettingsError = error instanceof Error ? error.message : "Could not load delivery settings.";
    console.error("Could not load delivery settings for the legacy checkout:", error);
    if (checkoutError) {
      checkoutError.textContent = "Delivery settings are unavailable. Please try again shortly.";
      checkoutError.hidden = false;
    }
  } finally {
    shippingSettingsLoading = false;
    renderCheckoutPage();
    updatePaymentButtonLabel();
  }
}

function updateCategoryButtons() {
  document.querySelectorAll(".category-card[data-category]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.category === state.activeCategory));
  });
}

function renderProducts(searchTerm = "") {
  if (!productGrid) return;

  updateWishlistHeader();
  updateCategoryButtons();
  const normalizedQuery = searchTerm.trim().toLowerCase();
  const matchingProducts = !normalizedQuery
    ? products
    : products.filter((product) => {
        const haystack = [
          product.name,
          product.brand,
          product.category,
          product.description,
          product.badge
        ]
          .join(" ")
          .toLowerCase();

        const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

        if (!queryTerms.length) return true;

        return queryTerms.every((term) => {
          if (term.length <= 2) return haystack.includes(term);
          return haystack.includes(term) || product.name.toLowerCase().includes(term);
        });
      });
  const categoryProducts = state.activeCategory
    ? matchingProducts.filter((product) => product.category === state.activeCategory)
    : matchingProducts;
  const visibleProducts = state.wishlistOnly
    ? categoryProducts.filter((product) => state.wishlist.includes(product.id))
    : categoryProducts;

  if (!visibleProducts.length) {
    productGrid.innerHTML = `
      <div class="search-empty">
        <h3>${state.wishlistOnly && !state.wishlist.length ? "Your wishlist is empty" : "No matching products found"}</h3>
        <p>${state.wishlistOnly && !state.wishlist.length ? "Tap a heart on any product to save it here." : "Try terms like phone, laptop, rice, beauty, fashion, home, or air fryer."}</p>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = visibleProducts
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-thumb" style="background-image: url('${product.image}')">
            <span class="deal-badge${/limited stock|low stock/i.test(product.badge) ? " low-stock" : ""}">${product.badge}</span>
            <button
              class="wishlist-btn${state.wishlist.includes(product.id) ? " is-active" : ""}"
              type="button"
              data-product-id="${product.id}"
              aria-label="${state.wishlist.includes(product.id) ? "Remove from" : "Add to"} wishlist"
              aria-pressed="${state.wishlist.includes(product.id)}"
              title="${state.wishlist.includes(product.id) ? "Remove from" : "Add to"} wishlist"
            >${state.wishlist.includes(product.id) ? "♥" : "♡"}</button>
          </div>

          <div class="product-body">
            <div class="brand-line">
              <span>${product.brand}</span>
              <span class="product-rating">★ ${product.rating}</span>
            </div>

            <h3>${product.name}</h3>

            <div class="price-row">
              <strong>${formatPrice(product.price)}</strong>
              <span>${formatPrice(product.oldPrice)}</span>
            </div>

            <div class="delivery-line${/cash on delivery|cod available|available for cod/i.test(product.delivery) ? " delivery-success" : ""}">${product.delivery}</div>

            <div class="card-actions">
              <button class="add-to-cart" type="button" data-product-id="${product.id}">Add to cart</button>
              <button class="quick-view-btn" type="button" data-product-id="${product.id}">Quick view</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  const firstCard = productGrid.querySelector(".product-card");
  if (normalizedQuery && firstCard) {
    firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderCart() {
  if (!cartItems || !subtotalValue || !cartCount) return;

  if (checkoutButton) {
    checkoutButton.disabled = state.cart.length === 0;
  }

  if (!state.cart.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        Your cart is empty.<br />
        Add some top deals to get started.
      </div>
    `;
    subtotalValue.textContent = formatPrice(0);
    cartCount.textContent = "0";
    return;
  }

  cartItems.innerHTML = state.cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.id);
      if (!product) return "";

      return `
        <div class="cart-item">
          <div class="cart-item-image" style="background-image: url('${product.image}')"></div>
          <div class="cart-item-info">
            <h4>${product.name}</h4>
            <span>Qty: ${item.quantity}</span>
          </div>
          <div class="item-price">${formatPrice(product.price * item.quantity)}</div>
        </div>
      `;
    })
    .join("");

  subtotalValue.textContent = formatPrice(getSubtotal());
  cartCount.textContent = String(getCartCount());
}

function renderCheckoutPage() {
  if (!checkoutItems || !checkoutSubtotal || !checkoutShipping || !checkoutTotal) return;

  if (checkoutForm) {
    checkoutForm.hidden = state.cart.length === 0;
  }
  if (checkoutEmpty) {
    checkoutEmpty.hidden = state.cart.length > 0;
  }

  if (!state.cart.length) {
    checkoutItems.innerHTML = '<div class="checkout-empty">Your cart is empty.</div>';
    checkoutSubtotal.textContent = formatPrice(0);
    if (checkoutDiscountRow) checkoutDiscountRow.hidden = true;
    checkoutShipping.textContent = formatPrice(0);
    checkoutTotal.textContent = formatPrice(0);
    return;
  }

  const subtotal = getSubtotal();
  const hasFreeDelivery = shippingSettings.freeDeliveryEnabled &&
    subtotal >= shippingSettings.minAmountForFree;
  const shipping = subtotal === 0 || hasFreeDelivery ? 0 : shippingSettings.shippingFee;
  const discount = checkoutCouponCode === "ZAVI10" ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount + shipping;

  checkoutItems.innerHTML = state.cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.id);
      if (!product) return "";

      return `
        <div class="checkout-item">
          <div>
            <strong>${product.name}</strong>
            <span>Qty: ${item.quantity}</span>
          </div>
          <span>${formatPrice(product.price * item.quantity)}</span>
        </div>
      `;
    })
    .join("");

  checkoutSubtotal.textContent = formatPrice(subtotal);
  if (checkoutDiscountRow && checkoutDiscount) {
    checkoutDiscountRow.hidden = discount === 0;
    checkoutDiscount.textContent = `- ${formatPrice(discount)}`;
  }
  checkoutShipping.textContent = shipping === 0 ? "Free" : formatPrice(shipping);
  checkoutTotal.textContent = formatPrice(total);
}

function toggleCart(open) {
  if (!cartDrawer || !cartOverlay) return;
  cartDrawer.classList.toggle("open", open);
  cartOverlay.classList.toggle("visible", open);
}

function openProductModal(productId) {
  const product = products.find((entry) => entry.id === Number(productId));
  if (!product || !modalContent || !productModal || !modalOverlay) return;

  modalContent.innerHTML = `
    <div class="modal-visual" style="background-image: url('${product.image}')"></div>
    <div class="modal-copy">
      <span class="mini-label">${product.badge}</span>
      <h2>${product.name}</h2>
      <p>${product.description}</p>

      <div class="modal-meta">
        <div class="meta-box">
          <span>Price</span>
          <strong>${formatPrice(product.price)}</strong>
        </div>
        <div class="meta-box">
          <span>Brand</span>
          <strong>${product.brand}</strong>
        </div>
        <div class="meta-box">
          <span>Delivery</span>
          <strong>${product.delivery}</strong>
        </div>
      </div>

      <div class="modal-actions">
        <button class="add-to-cart primary-btn" type="button" data-product-id="${product.id}">Add to cart</button>
        <button class="quick-view-btn" type="button" data-close-modal="true">Continue shopping</button>
      </div>
    </div>
  `;

  productModal.classList.add("open");
  modalOverlay.classList.add("visible");
}

function closeProductModal() {
  if (!productModal || !modalOverlay) return;
  productModal.classList.remove("open");
  modalOverlay.classList.remove("visible");
}

function openLoginModal() {
  if (!loginModal) return;
  loginModal.classList.add("open");
  if (modalOverlay) modalOverlay.classList.add("visible");
}

function closeLoginModalPanel() {
  if (!loginModal) return;
  loginModal.classList.remove("open");
  if (modalOverlay) modalOverlay.classList.remove("visible");
}

function handleAddToCart(productId) {
  const id = Number(productId);
  const productIndex = state.cart.findIndex((item) => item.id === id);

  if (productIndex === -1) {
    state.cart.push({ id, quantity: 1 });
  } else {
    state.cart[productIndex].quantity += 1;
  }

  saveCart();
  renderCart();
  renderCheckoutPage();

  if (cartCount) {
    cartCount.textContent = String(getCartCount());
  }
}

function toggleWishlist(productId) {
  const id = Number(productId);
  const product = products.find((entry) => entry.id === id);
  if (!product) return;

  const index = state.wishlist.indexOf(id);
  if (index === -1) {
    state.wishlist.push(id);
  } else {
    state.wishlist.splice(index, 1);
  }

  saveWishlist();
  updateWishlistHeader();

  if (state.wishlistOnly) {
    renderProducts(searchInput?.value || "");
    return;
  }

  const button = document.querySelector(`.wishlist-btn[data-product-id="${id}"]`);
  if (button) {
    const isWishlisted = index === -1;
    button.classList.toggle("is-active", isWishlisted);
    button.textContent = isWishlisted ? "♥" : "♡";
    button.setAttribute("aria-pressed", String(isWishlisted));
    button.setAttribute("aria-label", `${isWishlisted ? "Remove from" : "Add to"} wishlist`);
    button.title = `${isWishlisted ? "Remove from" : "Add to"} wishlist`;
  }
}

function updateWishlistHeader() {
  if (wishlistCount) {
    wishlistCount.textContent = String(state.wishlist.length);
  }
  if (wishlistButton) {
    const label = state.wishlistOnly ? "Show all products" : "Show wishlist";
    wishlistButton.setAttribute("aria-pressed", String(state.wishlistOnly));
    wishlistButton.setAttribute("aria-label", `${label}, ${state.wishlist.length} saved`);
    wishlistButton.title = label;
  }
}

document.addEventListener("click", (event) => {
  const categoryButton = event.target.closest(".category-card[data-category]");
  if (categoryButton) {
    state.activeCategory = state.activeCategory === categoryButton.dataset.category
      ? ""
      : categoryButton.dataset.category;
    state.wishlistOnly = false;
    updateWishlistHeader();
    renderProducts(searchInput?.value || "");
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const closeModalTrigger = event.target.closest("[data-close-modal='true']");
  if (closeModalTrigger) {
    closeProductModal();
    return;
  }

  const wishlistButton = event.target.closest(".wishlist-btn");
  if (wishlistButton) {
    toggleWishlist(wishlistButton.dataset.productId);
    return;
  }

  const quickViewButton = event.target.closest(".quick-view-btn");
  if (quickViewButton && !quickViewButton.classList.contains("primary-btn")) {
    openProductModal(quickViewButton.dataset.productId);
    return;
  }

  const addButton = event.target.closest(".add-to-cart");
  if (addButton) {
    handleAddToCart(addButton.dataset.productId);

    if (productModal && productModal.classList.contains("open")) {
      closeProductModal();
    }

    const button = addButton;
    button.textContent = "Added";
    button.disabled = true;

    setTimeout(() => {
      button.textContent = "Add to cart";
      button.disabled = false;
    }, 1000);

    return;
  }

  const checkoutButton = event.target.closest(".checkout-btn");
  if (checkoutButton && state.cart.length) {
    window.location.href = "checkout.html";
  }
});

if (searchInput && searchButton) {
  const applySearch = () => renderProducts(searchInput.value);

  searchInput.addEventListener("input", applySearch);
  searchButton.addEventListener("click", (event) => {
    event.preventDefault();
    applySearch();
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearch();
    }
  });

  searchInput.setAttribute("autocomplete", "off");
  searchInput.setAttribute("aria-label", "Search products");
}

if (wishlistButton) {
  wishlistButton.addEventListener("click", () => {
    state.wishlistOnly = !state.wishlistOnly;
    updateWishlistHeader();
    renderProducts(searchInput?.value || "");
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (cartButton) {
  cartButton.addEventListener("click", () => toggleCart(true));
}

if (closeCart) {
  closeCart.addEventListener("click", () => toggleCart(false));
}

if (cartOverlay) {
  cartOverlay.addEventListener("click", () => {
    toggleCart(false);
    closeProductModal();
  });
}

if (closeModal) {
  closeModal.addEventListener("click", closeProductModal);
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", closeProductModal);
}

if (loginButton) {
  loginButton.addEventListener("click", () => {
    openLoginModal();
  });
}

if (closeLoginModal) {
  closeLoginModal.addEventListener("click", () => {
    closeLoginModalPanel();
  });
}

if (modalOverlay) {
  modalOverlay.addEventListener("click", () => {
    closeLoginModalPanel();
    closeProductModal();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const emailField = loginForm.querySelector('input[name="loginEmail"]');
    const passwordField = loginForm.querySelector('input[name="loginPassword"]');
    const submitButton = loginForm.querySelector("button[type='submit']");

    if (!emailField.value || !passwordField.value || passwordField.value.length < 6) {
      if (loginStatus) {
        loginStatus.textContent = "Please enter a valid email and password.";
        loginStatus.dataset.state = "error";
      }
      return;
    }

    submitButton.textContent = "Logging in...";
    submitButton.disabled = true;

    const displayName = emailField.value.split("@")[0] || "Customer";
    if (loginStatus) {
      loginStatus.textContent = `Welcome back, ${displayName}!`;
      loginStatus.dataset.state = "success";
    }

    if (loginButton) {
      loginButton.textContent = `Hi, ${displayName}`;
    }

    setTimeout(() => {
      closeLoginModalPanel();
      submitButton.textContent = "Login";
      submitButton.disabled = false;
      loginForm.reset();
    }, 1200);
  });
}

if (newsletterForm) {
  newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const emailField = newsletterForm.querySelector("input[type='email']");
    const button = newsletterForm.querySelector("button");

    button.textContent = "Subscribed";
    emailField.value = "";
    emailField.placeholder = "You’re on the list!";

    setTimeout(() => {
      button.textContent = "Join now";
      emailField.placeholder = "Enter your email";
    }, 1800);
  });
}

if (returnRequestForm) {
  returnRequestForm.addEventListener("invalid", () => {
    if (returnRequestStatus) {
      returnRequestStatus.textContent = "Please enter your order number, phone, and return reason.";
    }
  }, true);

  returnRequestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(returnRequestForm);
    const message = [
      "Return request",
      `Order number: ${formData.get("orderId")}`,
      `Phone: ${formData.get("phone")}`,
      `Reason: ${formData.get("reason")}`,
      formData.get("details") ? `Details: ${formData.get("details")}` : ""
    ].filter(Boolean).join("\n");
    const whatsappUrl = `https://wa.me/${WHATSAPP_RECIPIENT}?text=${encodeURIComponent(message)}`;

    if (returnRequestStatus) {
      returnRequestStatus.replaceChildren(
        document.createTextNode("Your request is ready. Open WhatsApp and send it to support: ")
      );
      const whatsappLink = document.createElement("a");
      whatsappLink.href = whatsappUrl;
      whatsappLink.target = "_blank";
      whatsappLink.rel = "noopener noreferrer";
      whatsappLink.textContent = "Open WhatsApp if it did not open";
      returnRequestStatus.append(whatsappLink);
      whatsappLink.click();
    }
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (shippingSettingsLoading || shippingSettingsError) return;
    if (!state.cart.length) return;

    const submitButton = checkoutForm.querySelector("button[type='submit']");
    const formData = new FormData(checkoutForm);
    const selectedPaymentMethod = formData.get("paymentMethod");
    const submittedItems = state.cart.map(({ id, quantity }) => ({ id, quantity }));
    const whatsappWindow = selectedPaymentMethod === "cod" ? window.open("about:blank", "_blank") : null;
    submitButton.textContent = selectedPaymentMethod === "easypaisa"
      ? "Preparing Easypaisa order..."
      : selectedPaymentMethod === "cod"
        ? "Placing COD order..."
        : "Connecting to Safepay...";
    submitButton.disabled = true;
    if (checkoutError) checkoutError.hidden = true;

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: submittedItems,
          customer: {
            name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
            email: formData.get("email"),
            phone: formData.get("phone"),
            address: formData.get("address"),
            city: formData.get("city"),
            postalCode: formData.get("zip"),
            deliveryLocation: deliveryLatitude?.value && deliveryLongitude?.value
              ? { latitude: Number(deliveryLatitude.value), longitude: Number(deliveryLongitude.value) }
              : null
          },
          paymentMethod: selectedPaymentMethod,
          couponCode: checkoutCouponCode
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start checkout.");
      if (selectedPaymentMethod === "cod") {
        codConfirmation.textContent = `Order ${result.orderId} is confirmed. Pay ${formatPrice(result.amount)} in cash when your order arrives.`;
        openWhatsAppOrderSummary({
          orderId: result.orderId,
          status: "Cash on Delivery order confirmed",
          customer: {
            name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
            email: formData.get("email"),
            phone: formData.get("phone"),
            address: formData.get("address"),
            city: formData.get("city"),
            postalCode: formData.get("zip"),
            deliveryLocation: deliveryLatitude?.value && deliveryLongitude?.value
              ? { latitude: Number(deliveryLatitude.value), longitude: Number(deliveryLongitude.value) }
              : null
          },
          items: submittedItems,
          subtotal: result.subtotal,
          shipping: result.shipping,
          amount: result.amount,
          paymentMethod: "Cash on Delivery",
          whatsappNotificationSent: result.whatsappNotificationSent
        }, whatsappWindow, codWhatsAppLink, codWhatsAppNote);
        checkoutForm.hidden = true;
        codPanel.hidden = false;
        state.cart = [];
        saveCart();
        return;
      }
      if (selectedPaymentMethod === "easypaisa") {
        easypaisaOrderId = result.orderId;
        easypaisaOrderSummary = {
          orderId: result.orderId,
          status: "Easypaisa transfer submitted for manual verification",
          customer: {
            name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
            email: formData.get("email"),
            phone: formData.get("phone"),
            address: formData.get("address"),
            city: formData.get("city"),
            postalCode: formData.get("zip")
          },
          items: submittedItems,
          subtotal: result.subtotal,
          shipping: result.shipping,
          amount: result.amount,
          paymentMethod: "Easypaisa"
        };
        easypaisaInstructions.textContent = `Transfer exactly ${formatPrice(result.amount)} to this Easypaisa mobile account. Include your order ID ${result.orderId} in the transfer note if available.`;
        easypaisaAccount.textContent = result.accountNumber;
        checkoutForm.hidden = true;
        easypaisaPanel.hidden = false;
        return;
      }
      if (!result.checkoutUrl) throw new Error("Safepay did not return a checkout link.");
      sessionStorage.setItem(PENDING_ORDER_SUMMARY_KEY, JSON.stringify({
        orderId: result.orderId,
        status: "Safepay payment confirmed",
        customer: {
          name: `${formData.get("firstName")} ${formData.get("lastName")}`.trim(),
          email: formData.get("email"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          city: formData.get("city"),
          postalCode: formData.get("zip"),
          deliveryLocation: deliveryLatitude?.value && deliveryLongitude?.value
            ? { latitude: Number(deliveryLatitude.value), longitude: Number(deliveryLongitude.value) }
            : null
        },
        items: submittedItems,
        subtotal: result.subtotal,
        shipping: result.shipping,
        amount: result.amount,
        paymentMethod: "Safepay"
      }));
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      if (checkoutError) {
        checkoutError.textContent = getPaymentErrorMessage(error);
        checkoutError.hidden = false;
      }
      updatePaymentButtonLabel();
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (easypaisaReferenceForm) {
  easypaisaReferenceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!easypaisaOrderId) return;

    const submitButton = easypaisaReferenceForm.querySelector("button[type='submit']");
    const transactionReference = new FormData(easypaisaReferenceForm).get("transactionReference").trim();
    const whatsappWindow = window.open("about:blank", "_blank");
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    easypaisaError.hidden = true;

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(easypaisaOrderId)}/easypaisa-reference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionReference })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your reference.");

      easypaisaSubmitted.textContent = `Reference received for order ${result.orderId}. Payment is awaiting manual verification; it is not confirmed yet.`;
      easypaisaSubmitted.hidden = false;
      if (easypaisaOrderSummary) {
        easypaisaOrderSummary.transactionReference = transactionReference;
        easypaisaOrderSummary.whatsappNotificationSent = result.whatsappNotificationSent;
        openWhatsAppOrderSummary(
          easypaisaOrderSummary,
          whatsappWindow,
          easypaisaWhatsAppLink,
          easypaisaWhatsAppNote
        );
      }
      easypaisaReferenceForm.hidden = true;
    } catch (error) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      easypaisaError.textContent = getPaymentErrorMessage(error);
      easypaisaError.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = "Submit payment reference";
    }
  });
}

if (copyEasypaisaAccount && easypaisaAccount) {
  copyEasypaisaAccount.addEventListener("click", async () => {
    await navigator.clipboard.writeText(easypaisaAccount.textContent);
    copyEasypaisaAccount.textContent = "Copied";
    setTimeout(() => {
      copyEasypaisaAccount.textContent = "Copy";
    }, 1500);
  });
}

if (paymentMethod) {
  paymentMethod.addEventListener("change", updatePaymentButtonLabel);
  updatePaymentButtonLabel();
  configurePaymentMethods().then(updatePaymentButtonLabel);
}

if (paymentStatus) {
  async function checkPaymentStatus() {
    const orderId = new URLSearchParams(window.location.search).get("order");
    const wasCancelled = new URLSearchParams(window.location.search).has("cancelled");
    if (!orderId) {
      paymentStatus.textContent = "No order reference was provided.";
      return;
    }

    paymentStatus.textContent = wasCancelled
      ? "Waiting for Safepay to confirm the payment. Your cart is saved if you need to retry."
      : "Waiting for Safepay payment confirmation...";

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
        if (!response.ok) throw new Error("Order status is not available yet.");
        const order = await response.json();

        if (order.paymentStatus === "paid") {
          localStorage.removeItem(STORAGE_KEY);
          paymentStatus.textContent = `Payment confirmed. Your order ${order.orderId} is paid (${formatPrice(order.amount)}).`;
          try {
            const summary = JSON.parse(sessionStorage.getItem(PENDING_ORDER_SUMMARY_KEY) || "null");
            if (summary?.orderId === order.orderId) {
              summary.status = "Safepay payment confirmed";
              summary.whatsappNotificationSent = order.whatsappNotificationSent;
              openWhatsAppOrderSummary(summary, null, paymentWhatsAppLink, paymentWhatsAppNote);
            }
            sessionStorage.removeItem(PENDING_ORDER_SUMMARY_KEY);
          } catch (error) {
            sessionStorage.removeItem(PENDING_ORDER_SUMMARY_KEY);
          }
          return;
        }
        if (["failed", "checkout_error"].includes(order.paymentStatus)) {
          paymentStatus.textContent = "Payment was not completed. Your cart is still saved; return to checkout to try again.";
          return;
        }
      } catch (error) {
        if (attempt === 19) {
          paymentStatus.textContent = "We could not verify the payment yet. Your cart is saved; check again shortly.";
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    paymentStatus.textContent = "Payment is still being confirmed. Your cart is saved; check again shortly.";
  }

  checkPaymentStatus();
}

renderProducts();
renderCart();
renderCheckoutPage();
if (checkoutShipping) void loadShippingSettings();
