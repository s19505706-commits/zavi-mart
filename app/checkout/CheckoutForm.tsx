"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CART_STORAGE_KEY,
  CHECKOUT_PRODUCTS_BY_CART_ID,
  STARTER_CART_ITEMS,
  type CartItem
} from "../../lib/cart";
import { PAK_CITIES } from "../../lib/pak-cities";
import type { ShippingSettings } from "../../lib/shippingSettings";
import styles from "./checkout.module.css";

type CheckoutItem = {
  id: string;
  quantity: number;
  name: string;
  price: number;
  selectedVariants?: Record<string, string>;
  variantId?: string;
};

type OrderResult = {
  orderId: string;
  amount: number;
  error?: string;
};

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const DEFAULT_SHIPPING: ShippingSettings = {
  freeDeliveryEnabled: true,
  minAmountForFree: 2999,
  shippingFee: 149,
  bannerText: "Free delivery above Rs 2,999",
  updatedAt: ""
};

type MapPosition = { latitude: number; longitude: number };
type LeafletLatLng = { lat: number; lng: number };
type LeafletMarker = {
  addTo(map: LeafletMap): LeafletMarker;
  remove(): void;
  setLatLng(position: [number, number]): LeafletMarker;
  getLatLng(): LeafletLatLng;
  on(event: "dragend", handler: () => void): LeafletMarker;
};
type LeafletMap = {
  setView(position: [number, number], zoom: number): LeafletMap;
  on(event: "click", handler: (event: { latlng: LeafletLatLng }) => void): LeafletMap;
  remove(): void;
};
type LeafletApi = {
  map(element: HTMLElement, options?: { scrollWheelZoom?: boolean }): LeafletMap;
  tileLayer(url: string, options: { maxZoom: number; attribution: string }): { addTo(map: LeafletMap): void };
  divIcon(options: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number] }): object;
  marker(position: [number, number], options: { draggable: boolean; icon: object }): LeafletMarker;
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

let leafletLoading: Promise<LeafletApi> | null = null;

function loadLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;

  const loading = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.getElementById("zavimart-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "zavimart-leaflet-css";
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.append(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-zavimart-leaflet]");
    const script = existingScript ?? document.createElement("script");
    script.dataset.zavimartLeaflet = "true";
    script.src = LEAFLET_JS_URL;
    script.onload = () => window.L
      ? resolve(window.L)
      : reject(new Error("Map library loaded without its API."));
    script.onerror = () => reject(new Error("Could not load the delivery map."));
    if (!existingScript) document.body.append(script);
  }).catch((error: unknown) => {
    leafletLoading = null;
    throw error;
  });

  leafletLoading = loading;
  return loading;
}

function formatRupees(amount: number) {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCheckoutItems(cart: CartItem[]): CheckoutItem[] {
  return cart.flatMap((item) => {
    const checkoutProduct = CHECKOUT_PRODUCTS_BY_CART_ID[item.id];
    const id = item.productId ?? (item.checkoutProductId ?? checkoutProduct?.id)?.toString();
    if (!id) return [];
    return [{
      id: String(id),
      quantity: item.quantity,
      name: checkoutProduct?.name ?? item.name,
      price: checkoutProduct?.price ?? item.price,
      ...(item.selectedVariants ? { selectedVariants: item.selectedVariants } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {})
    }];
  });
}

function loadCartFromStorage(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return STARTER_CART_ITEMS;
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed as CartItem[] : [];
  } catch (error) {
    console.error("Could not load the saved cart:", error);
    return [];
  }
}

export default function CheckoutForm() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState("");
  const [shippingSettings, setShippingSettings] = useState(DEFAULT_SHIPPING);
  const [shippingError, setShippingError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [streetAddress, setStreetAddress] = useState("");
  const [areaSector, setAreaSector] = useState("");
  const [city, setCity] = useState("Gujranwala-Punjab");
  const [otherCity, setOtherCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [deliveryPin, setDeliveryPin] = useState<MapPosition | null>(null);
  const [mapStatus, setMapStatus] = useState("Enter your street address and city, then locate the delivery pin.");
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState("");
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markerInstance = useRef<LeafletMarker | null>(null);

  const clearDeliveryPin = useCallback((message: string) => {
    markerInstance.current?.remove();
    markerInstance.current = null;
    setDeliveryPin(null);
    setMapStatus(message);
  }, []);

  const setPin = useCallback((latitude: number, longitude: number, message: string) => {
    const leaflet = window.L;
    const map = mapInstance.current;
    if (!leaflet || !map) return;

    const position: [number, number] = [latitude, longitude];
    if (!markerInstance.current) {
      const pinIcon = leaflet.divIcon({
        className: styles.mapPinIcon,
        html: '<span></span>',
        iconSize: [24, 34],
        iconAnchor: [12, 32]
      });
      markerInstance.current = leaflet.marker(position, { draggable: true, icon: pinIcon }).addTo(map);
      markerInstance.current.on("dragend", () => {
        const selected = markerInstance.current?.getLatLng();
        if (selected) {
          setDeliveryPin({ latitude: selected.lat, longitude: selected.lng });
          setMapStatus("Pin moved. This location will be saved with your order.");
        }
      });
    } else {
      markerInstance.current.setLatLng(position);
    }

    setDeliveryPin({ latitude, longitude });
    setMapStatus(message);
    map.setView(position, 16);
  }, []);

  useEffect(() => {
    let disposed = false;
    fetch("/api/shipping", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result)) {
          throw new Error("Could not load delivery settings.");
        }
        const settings = result;
        if (
          typeof settings.freeDeliveryEnabled !== "boolean" ||
          typeof settings.minAmountForFree !== "number" ||
          typeof settings.shippingFee !== "number" ||
          typeof settings.bannerText !== "string" ||
          typeof settings.updatedAt !== "string"
        ) {
          throw new Error("Could not load delivery settings.");
        }
        if (!disposed) {
          setShippingSettings({
            freeDeliveryEnabled: settings.freeDeliveryEnabled,
            minAmountForFree: settings.minAmountForFree,
            shippingFee: settings.shippingFee,
            bannerText: settings.bannerText,
            updatedAt: settings.updatedAt
          });
        }
      })
      .catch((loadError: unknown) => {
        if (!disposed) setShippingError(loadError instanceof Error ? loadError.message : "Could not load delivery settings.");
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    loadLeaflet().then((leaflet) => {
      if (disposed || !mapElement.current) return;
      const map = leaflet.map(mapElement.current, { scrollWheelZoom: false })
        .setView([30.3753, 69.3451], 5);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      map.on("click", ({ latlng }) => {
        setPin(latlng.lat, latlng.lng, "Pin selected. This location will be saved with your order.");
      });
      mapInstance.current = map;
    }).catch((loadError: unknown) => {
      if (!disposed) {
        setMapError(loadError instanceof Error ? loadError.message : "Could not load the delivery map.");
      }
    });

    return () => {
      disposed = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerInstance.current = null;
    };
  }, [setPin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get("cart");

    if (cartParam) {
      try {
        const parsed: unknown = JSON.parse(cartParam);
        if (!Array.isArray(parsed)) throw new Error("Cart data must be a list.");
        const savedCart = loadCartFromStorage();
        const resolved = parsed.flatMap((entry) => {
          const id = typeof entry?.id === "string" || typeof entry?.id === "number"
            ? String(entry.id)
            : "";
          const quantity = Number(entry?.quantity);
          if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return [];
          const rawSelected = entry?.selectedVariants;
          const selectedVariants = isRecord(rawSelected) &&
            Object.entries(rawSelected).every(([key, value]) => key.length > 0 && typeof value === "string")
            ? rawSelected as Record<string, string>
            : undefined;
          const product = savedCart.find((item) =>
            String(item.productId ?? item.checkoutProductId ?? CHECKOUT_PRODUCTS_BY_CART_ID[item.id]?.id ?? item.id) === id &&
            JSON.stringify(item.selectedVariants ?? {}) === JSON.stringify(selectedVariants ?? {})
          ) ?? STARTER_CART_ITEMS.find((item) => String(item.checkoutProductId) === id);
          if (!product) return [];
          return [{ ...product, quantity }];
        });
        setCart(resolved);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(resolved));
        setCoupon(params.get("coupon")?.toUpperCase() === "ZAVI10" ? "ZAVI10" : "");
        return;
      } catch (parseError) {
        console.error("Could not import the cart for checkout:", parseError);
        setError("We couldn’t load your cart. Please return to your cart and try again.");
      }
    }

    setCart(loadCartFromStorage());
  }, []);

  const items = getCheckoutItems(cart);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const hasFreeDelivery = shippingSettings.freeDeliveryEnabled && subtotal >= shippingSettings.minAmountForFree;
  const shipping = subtotal === 0 || hasFreeDelivery ? 0 : shippingSettings.shippingFee;
  const discount = coupon === "ZAVI10" ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount + shipping;

  async function locateAddress() {
    const selectedCity = city === "Other" ? otherCity.trim() : city;
    if (!streetAddress.trim() || !selectedCity) {
      setMapStatus("Enter your street address and select a city first.");
      return;
    }

    setLocating(true);
    setMapError("");
    setMapStatus("Searching for your address...");
    try {
      const query = [streetAddress.trim(), areaSector.trim(), selectedCity, postalCode.trim(), "Pakistan"].filter(Boolean).join(", ");
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const result = await response.json() as {
        latitude?: number;
        longitude?: number;
        displayName?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Could not find this address.");
      if (typeof result.latitude !== "number" || !Number.isFinite(result.latitude)
        || typeof result.longitude !== "number" || !Number.isFinite(result.longitude)) {
        throw new Error("No matching address found. Click the map to place the pin manually.");
      }
      setPin(
        result.latitude,
        result.longitude,
        `Address located: ${result.displayName || `${streetAddress}, ${areaSector}, ${selectedCity}`}. Drag the pin to adjust it.`
      );
    } catch (lookupError) {
      setMapStatus(lookupError instanceof Error ? lookupError.message : "Address lookup failed.");
    } finally {
      setLocating(false);
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || submitting) return;

    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ id, quantity, selectedVariants, variantId }) => ({
            id,
            quantity,
            ...(selectedVariants ? { selectedVariants } : {}),
            ...(variantId ? { variantId } : {})
          })),
          customer: {
            name: String(form.get("name") || "").trim(),
            email: form.get("email"),
            phone: form.get("phone"),
            alternatePhone: form.get("alternatePhone"),
            city: city === "Other" ? otherCity.trim() : city,
            areaSector: form.get("areaSector"),
            streetAddress: form.get("streetAddress"),
            address: [form.get("streetAddress"), form.get("areaSector")].filter(Boolean).join(", "),
            postalCode: form.get("postalCode"),
            deliveryLocation: deliveryPin
          },
          paymentMethod: "cod",
          couponCode: coupon
        })
      });
      const result = await response.json() as OrderResult;
      if (!response.ok) throw new Error(result.error || "We couldn’t place your order.");
      setOrder(result);
      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn’t place your order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ZaviMart home">
          <span className={styles.brandIcon} aria-hidden="true">
            <ShoppingCart size={32} strokeWidth={2.2} />
            <span />
          </span>
          <span>ZaviMart</span>
        </Link>
        <Link className={styles.backLink} href="/cart">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to cart
        </Link>
      </header>

      <div className={styles.layout}>
        <section className={styles.formCard}>
          {order ? (
            <div className={styles.confirmation} role="status">
              <span className={styles.eyebrow}>Order confirmed</span>
              <h1>Thank you for shopping with ZaviMart!</h1>
              <p>Your order <strong>{order.orderId}</strong> is confirmed.</p>
              <p>Pay {formatRupees(order.amount)} in cash when your order arrives.</p>
              <Link className={styles.primaryButton} href="/">Continue shopping</Link>
            </div>
          ) : (
            <>
              <span className={styles.eyebrow}>Complete your order</span>
              <h1>Checkout</h1>
              {!items.length ? (
                <div className={styles.emptyCart}>
                  <p>Your cart is empty or could not be loaded.</p>
                  <Link href="/cart">Return to cart</Link>
                </div>
              ) : (
                <form className={styles.form} onSubmit={placeOrder}>
                  <h2 className={styles.sectionHeading}>Contact details</h2>
                  <label>Customer name<input name="name" placeholder="Your full name" autoComplete="name" required /></label>
                  <div className={styles.formRow}>
                    <label>Phone number
                      <input name="phone" type="tel" placeholder="0300 1234567" autoComplete="tel" pattern="(?:\+92|0092|0)?3[0-9]{2}[\s-]?[0-9]{7}" title="Enter a valid Pakistani mobile number, such as 03001234567." required />
                    </label>
                    <label>Alternate phone (optional)
                      <input name="alternatePhone" type="tel" placeholder="0300 1234567" autoComplete="tel" pattern="(?:\+92|0092|0)?3[0-9]{2}[\s-]?[0-9]{7}" title="Enter a valid Pakistani mobile number." />
                    </label>
                  </div>
                  <label>Email (optional)<input name="email" type="email" placeholder="you@example.com" autoComplete="email" /></label>
                  <h2 className={styles.sectionHeading}>Address details</h2>
                  <label>City
                    <select name="city" autoComplete="address-level2" value={city} onChange={(event) => { setCity(event.target.value); clearDeliveryPin("City changed. Locate the updated address to place its pin."); }} required>
                      <option value="" disabled>Select city</option>
                      {PAK_CITIES.map((entry) => <option key={entry.label} value={entry.label}>{entry.label}</option>)}
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  {city === "Other" && (
                    <label>Enter city and province
                      <input value={otherCity} onChange={(event) => setOtherCity(event.target.value)} placeholder="City-Province" required />
                    </label>
                  )}
                  <label>Area / Sector
                    <input name="areaSector" value={areaSector} onChange={(event) => { setAreaSector(event.target.value); clearDeliveryPin("Area changed. Locate the updated address to place its pin."); }} placeholder="Nowshera Virkan, City Area-Nowshera Virkan" autoComplete="address-level3" required />
                  </label>
                  <label>Full Street Address / House No
                    <textarea name="streetAddress" value={streetAddress} onChange={(event) => { setStreetAddress(event.target.value); clearDeliveryPin("Address changed. Locate the updated address to place its pin."); }} placeholder="House No, Street, Leel Virkan etc" autoComplete="street-address" rows={3} required />
                  </label>
                  <div className={styles.formRow}>
                    <label>Postal code (optional)<input name="postalCode" value={postalCode} onChange={(event) => { setPostalCode(event.target.value); clearDeliveryPin("Postal code changed. Locate the updated address to place its pin."); }} placeholder="54000" autoComplete="postal-code" /></label>
                  </div>
                  <section className={styles.locationCard} aria-labelledby="deliveryLocationHeading">
                    <div className={styles.locationHeading}>
                      <div>
                        <h2 id="deliveryLocationHeading">Delivery location</h2>
                        <p>Locate the address on the map, then drag the pin or tap a precise spot.</p>
                      </div>
                      <button className={styles.locateButton} type="button" onClick={locateAddress} disabled={locating}>
                        {locating ? "Locating..." : "Locate address"}
                      </button>
                    </div>
                    <p className={styles.mapStatus} role="status" aria-live="polite">{mapStatus}</p>
                    {mapError && <p className={styles.mapError} role="alert">{mapError}</p>}
                    <div className={styles.map} ref={mapElement} role="application" aria-label="Select your delivery pin on the map" />
                    {deliveryPin && (
                      <p className={styles.pinCoordinates}>
                        Delivery pin: {deliveryPin.latitude.toFixed(6)}, {deliveryPin.longitude.toFixed(6)}
                      </p>
                    )}
                  </section>
                  <label>Payment method
                    <select value="cod" disabled aria-label="Payment method">
                      <option value="cod">Cash on Delivery</option>
                    </select>
                  </label>
                  {error && <p className={styles.error} role="alert">{error}</p>}
                  {shippingError && <p className={styles.error} role="alert">{shippingError}</p>}
                  <button className={styles.primaryButton} type="submit" disabled={submitting}>
                    <LockKeyhole size={17} aria-hidden="true" />
                    {submitting ? "Placing order..." : `Place order · ${formatRupees(total)}`}
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        {!order && (
          <aside className={styles.summaryCard}>
            <span className={styles.eyebrow}>Order summary</span>
            <h2>Your items</h2>
            <p className={styles.itemCount}>{itemCount} {itemCount === 1 ? "item" : "items"}</p>
            <div className={styles.items}>
              {items.map((item, index) => (
                <div className={styles.item} key={`${item.id}-${index}`}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                      <span>{Object.entries(item.selectedVariants).map(([name, value]) => `${name}: ${value}`).join(" · ")}</span>
                    )}
                    <span>Qty: {item.quantity}</span>
                  </div>
                  <strong>{formatRupees(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>
            {coupon && <p className={styles.coupon}>Coupon {coupon} applied · −{formatRupees(discount)}</p>}
            <div className={styles.summaryLine}><span>Subtotal</span><strong>{formatRupees(subtotal)}</strong></div>
            <div className={styles.summaryLine}><span>Shipping</span><strong className={shipping === 0 ? styles.free : ""}>{shipping === 0 ? "FREE" : formatRupees(shipping)}</strong></div>
            <div className={`${styles.summaryLine} ${styles.total}`}><span>Total</span><strong>{formatRupees(total)}</strong></div>
          </aside>
        )}
      </div>
    </main>
  );
}
