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
import styles from "./checkout.module.css";

type CheckoutItem = {
  id: number;
  quantity: number;
  name: string;
  price: number;
};

type OrderResult = {
  orderId: string;
  amount: number;
  error?: string;
};

const FREE_DELIVERY_MINIMUM = 3000;
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

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

function getCheckoutItems(cart: CartItem[]): CheckoutItem[] {
  return cart.flatMap((item) => {
    const checkoutProduct = CHECKOUT_PRODUCTS_BY_CART_ID[item.id];
    const id = item.checkoutProductId ?? checkoutProduct?.id;
    if (!id) return [];
    return [{
      id,
      quantity: item.quantity,
      name: checkoutProduct?.name ?? item.name,
      price: checkoutProduct?.price ?? item.price
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
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lahore");
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
          const id = Number(entry?.id);
          const quantity = Number(entry?.quantity);
          if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return [];
          const product = savedCart.find((item) => item.checkoutProductId === id)
            ?? STARTER_CART_ITEMS.find((item) => item.checkoutProductId === id);
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
  const shipping = subtotal >= FREE_DELIVERY_MINIMUM ? 0 : subtotal === 0 ? 0 : 299;
  const discount = coupon === "ZAVI10" ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount + shipping;

  async function locateAddress() {
    if (!address.trim() || !city.trim()) {
      setMapStatus("Enter your street address and select a city first.");
      return;
    }

    setLocating(true);
    setMapError("");
    setMapStatus("Searching for your address...");
    try {
      const query = [address.trim(), city.trim(), postalCode.trim(), "Pakistan"].filter(Boolean).join(", ");
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
        `Address located: ${result.displayName || `${address}, ${city}`}. Drag the pin to adjust it.`
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
          items: items.map(({ id, quantity }) => ({ id, quantity })),
          customer: {
            name: `${String(form.get("firstName") || "").trim()} ${String(form.get("lastName") || "").trim()}`.trim(),
            email: form.get("email"),
            phone: form.get("phone"),
            address: form.get("address"),
            city: form.get("city"),
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
                  <div className={styles.formRow}>
                    <label>First name<input name="firstName" placeholder="Your first name" autoComplete="given-name" required /></label>
                    <label>Last name<input name="lastName" placeholder="Your last name" autoComplete="family-name" required /></label>
                  </div>
                  <label>Email<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
                  <label>Mobile number<input name="phone" type="tel" placeholder="03xx xxxxxxx" autoComplete="tel" required /></label>
                  <label>Address<input name="address" value={address} onChange={(event) => { setAddress(event.target.value); clearDeliveryPin("Address changed. Locate the updated address to place its pin."); }} placeholder="Street address" autoComplete="street-address" required /></label>
                  <div className={styles.formRow}>
                    <label>City
                      <select name="city" autoComplete="address-level2" value={city} onChange={(event) => { setCity(event.target.value); clearDeliveryPin("City changed. Locate the updated address to place its pin."); }} required>
                        {["Lahore", "Karachi", "Islamabad", "Faisalabad", "Multan", "Gujranwala", "Sialkot", "Rawalpindi", "Peshawar", "Quetta", "Other"].map((city) => (
                          <option key={city}>{city}</option>
                        ))}
                      </select>
                    </label>
                    <label>Postal code<input name="postalCode" value={postalCode} onChange={(event) => { setPostalCode(event.target.value); clearDeliveryPin("Postal code changed. Locate the updated address to place its pin."); }} placeholder="54000" autoComplete="postal-code" required /></label>
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
                  <div><strong>{item.name}</strong><span>Qty: {item.quantity}</span></div>
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
