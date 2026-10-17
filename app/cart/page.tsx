"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, Minus, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  readCart,
  removeCartItem,
  saveCart,
  CHECKOUT_PRODUCTS_BY_CART_ID,
  updateCartItemQuantity,
  type CartItem
} from "../../lib/cart";
import type { ShippingSettings } from "../../lib/shippingSettings";

const DEFAULT_SHIPPING: ShippingSettings = {
  freeDeliveryEnabled: true,
  minAmountForFree: 2999,
  shippingFee: 149,
  bannerText: "Free delivery above Rs 2,999",
  updatedAt: ""
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [shippingSettings, setShippingSettings] = useState(DEFAULT_SHIPPING);
  const [shippingError, setShippingError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [updatingBundleIds, setUpdatingBundleIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function syncCart() {
      try {
        const items = readCart().map((item) => {
          const checkoutProduct = CHECKOUT_PRODUCTS_BY_CART_ID[item.id];
          return checkoutProduct
            ? { ...item, checkoutProductId: checkoutProduct.id, name: checkoutProduct.name, price: checkoutProduct.price }
            : item;
        });
        setCartItems((current) => JSON.stringify(current) === JSON.stringify(items) ? current : items);
      } catch (error) {
        console.error("Could not restore the cart.", error);
        toast.error("Your saved cart could not be loaded.");
      }
    }
    syncCart();
    window.addEventListener("cartUpdated", syncCart);
    window.addEventListener("zavimart_cart_updated", syncCart);
    window.addEventListener("storage", syncCart);
    setCartReady(true);
    return () => {
      window.removeEventListener("cartUpdated", syncCart);
      window.removeEventListener("zavimart_cart_updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
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
        if (!cancelled) {
          setShippingSettings({
            freeDeliveryEnabled: settings.freeDeliveryEnabled,
            minAmountForFree: settings.minAmountForFree,
            shippingFee: settings.shippingFee,
            bannerText: settings.bannerText,
            updatedAt: settings.updatedAt
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setShippingError(error instanceof Error ? error.message : "Could not load delivery settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cartReady) {
      try {
        saveCart(cartItems);
      } catch (error) {
        console.error("Could not save cart changes.", error);
        toast.error("Your cart changes could not be saved.");
      }
    }
  }, [cartItems, cartReady]);

  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const hasFreeDelivery = shippingSettings.freeDeliveryEnabled && subtotal >= shippingSettings.minAmountForFree;
  const shipping = subtotal === 0 || hasFreeDelivery ? 0 : shippingSettings.shippingFee;
  const total = subtotal + shipping;
  const freeDeliveryProgress = shippingSettings.minAmountForFree > 0
    ? Math.min((subtotal / shippingSettings.minAmountForFree) * 100, 100)
    : 100;

  async function changeQuantity(itemId: string, change: number) {
    const item = cartItems.find((cartItem) => cartItem.id === itemId);
    if (!item) return;
    if (item.bundleId && change > 0) {
      if (updatingBundleIds.has(itemId)) return;
      setUpdatingBundleIds((current) => new Set(current).add(itemId));
      try {
        const response = await fetch("/api/bundles/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.bundleId })
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = isRecord(result) && typeof result.error === "string"
            ? result.error
            : "This Value Set is no longer available.";
          throw new Error(message);
        }
        setCartItems((current) => updateCartItemQuantity(
          current,
          itemId,
          (current.find((cartItem) => cartItem.id === itemId)?.quantity ?? 1) + change
        ));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "This Value Set quantity could not be updated.");
      } finally {
        setUpdatingBundleIds((current) => {
          const next = new Set(current);
          next.delete(itemId);
          return next;
        });
      }
      return;
    }
    setCartItems((current) => updateCartItemQuantity(
      current,
      itemId,
      (current.find((item) => item.id === itemId)?.quantity ?? 1) + change
    ));
  }

  function removeItem(itemId: string) {
    setCartItems((current) => removeCartItem(current, itemId));
    toast.success("Item removed from your cart.");
  }

  function continueToCheckout() {
    if (!cartReady || cartItems.length === 0) return;
    const items = cartItems.map((item) => ({
      id: item.bundleId ?? item.productId ?? item.checkoutProductId ?? CHECKOUT_PRODUCTS_BY_CART_ID[item.id]?.id ?? null,
      quantity: item.quantity,
      ...(item.bundleId ? { isBundle: true } : {}),
      ...(item.selectedVariants ? { selectedVariants: item.selectedVariants } : {}),
      ...(item.variantId ? { variantId: item.variantId } : {})
    }));
    if (items.some((item) => item.id === null)) {
      setCheckoutMessage("One or more cart items are not available for checkout yet. Remove them and try again.");
      return;
    }

    const checkoutUrl = new URL("/checkout", window.location.origin);
    checkoutUrl.searchParams.set("cart", JSON.stringify(items));
    window.location.assign(checkoutUrl.toString());
  }

  return (
    <main className="cart-page">
      <header className="store-header cart-store-header">
        <Link className="store-brand" href="/" aria-label="ZaviMart home">
          <span className="store-brand-cart" aria-hidden="true">
            <ShoppingCart size={34} strokeWidth={2.2} />
            <span className="store-brand-cart-accent" />
          </span>
          <span className="store-brand-name"><span>Zavi</span><span>Mart</span></span>
        </Link>
        <Link className="cart-header-link" href="/">Continue shopping</Link>
      </header>

      <div className="cart-page-shell">
        <header className="cart-page-header">
          <div className="cart-page-title">
            <h1>Your cart</h1>
            <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </div>
        </header>

        {shippingError && <p role="alert">{shippingError}</p>}

        {!cartItems.length ? (
          <section className="cart-empty-card">
            <span className="cart-empty-icon"><ShoppingCart size={30} aria-hidden="true" /></span>
            <h2>Your cart is empty</h2>
            <p>Discover something special from our curated collection.</p>
            <Link className="cart-empty-link" href="/search">Shop now</Link>
          </section>
        ) : (
          <div className="cart-page-layout">
            <div className="cart-main-column">
              {shippingSettings.freeDeliveryEnabled && (
                <section className="delivery-progress-card" aria-label="Free delivery progress">
                  <div className="delivery-progress-heading">
                    <span className="delivery-truck-icon"><Truck size={20} aria-hidden="true" /></span>
                    <div>
                      <h2>{hasFreeDelivery ? "You’ve unlocked free delivery" : `Add Rs ${Math.max(0, shippingSettings.minAmountForFree - subtotal).toLocaleString("en-PK")} for free delivery`}</h2>
                      <p>{shippingSettings.bannerText}</p>
                    </div>
                    <strong>{Math.round(freeDeliveryProgress)}%</strong>
                  </div>
                  <div className="delivery-progress-track" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(freeDeliveryProgress)} role="progressbar">
                    <span style={{ width: `${freeDeliveryProgress}%` }} />
                  </div>
                </section>
              )}

              <section className="cart-product-list" aria-label="Cart products">
                {cartItems.map((item) => (
                  <article className="cart-product-card" key={item.id}>
                    <div className="cart-product-image">
                      <Image src={item.image} alt={item.name} fill sizes="80px" unoptimized loading="lazy" />
                    </div>
                    <div className="cart-product-details">
                      <h2>{item.name}</h2>
                      {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                        <span className="cart-product-unit">
                          {Object.entries(item.selectedVariants).map(([name, value]) => `${name}: ${value}`).join(" · ")}
                        </span>
                      )}
                      <span className="cart-product-unit">Rs {item.price.toLocaleString("en-PK")} each</span>
                      <div className="cart-product-controls">
                        <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                          <button type="button" aria-label={`Decrease ${item.name} quantity`} disabled={updatingBundleIds.has(item.id)} onClick={() => void changeQuantity(item.id, -1)}>
                            <Minus size={15} aria-hidden="true" />
                          </button>
                          <span aria-live="polite">{item.quantity}</span>
                          <button type="button" aria-label={`Increase ${item.name} quantity`} disabled={updatingBundleIds.has(item.id)} onClick={() => void changeQuantity(item.id, 1)}>
                            <Plus size={15} aria-hidden="true" />
                          </button>
                        </div>
                        <button className="remove-cart-item" type="button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}>
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <strong className="cart-product-total">Rs {(item.price * item.quantity).toLocaleString("en-PK")}</strong>
                  </article>
                ))}
              </section>
            </div>

            <aside className="order-summary-card" aria-labelledby="order-summary-title">
              <h2 id="order-summary-title">Order summary</h2>
              <div className="summary-line">
                <span>Subtotal</span>
                <strong>Rs {subtotal.toLocaleString("en-PK")}</strong>
              </div>
              <div className="summary-line">
                <span>Shipping</span>
                <strong className={shipping === 0 ? "shipping-free" : ""}>{shipping === 0 ? "FREE" : `Rs ${shipping.toLocaleString("en-PK")}`}</strong>
              </div>
              <div className="summary-line summary-total">
                <span>Total</span>
                <strong>Rs {total.toLocaleString("en-PK")}</strong>
              </div>

              <button className="checkout-button" type="button" onClick={continueToCheckout}>
                <LockKeyhole size={17} aria-hidden="true" />
                Continue to checkout
              </button>
              <p className="checkout-message" role="status" aria-live="polite">{checkoutMessage}</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
