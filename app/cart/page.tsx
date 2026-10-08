"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, Minus, Plus, ShoppingCart, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CART_STORAGE_KEY,
  CHECKOUT_PRODUCTS_BY_CART_ID,
  STARTER_CART_ITEMS,
  type CartItem
} from "../../lib/cart";

const FREE_DELIVERY_MINIMUM = 3000;

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>(STARTER_CART_ITEMS);
  const [cartReady, setCartReady] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponMessageState, setCouponMessageState] = useState<"success" | "error" | "">("");
  const [checkoutMessage, setCheckoutMessage] = useState("");

  useEffect(() => {
    try {
      const savedItems = localStorage.getItem(CART_STORAGE_KEY);
      if (savedItems) {
        const parsedItems: unknown = JSON.parse(savedItems);
        if (Array.isArray(parsedItems)) {
          setCartItems((parsedItems as CartItem[]).map((item) => {
            const checkoutProduct = CHECKOUT_PRODUCTS_BY_CART_ID[item.id];
            return checkoutProduct
              ? {
                  ...item,
                  checkoutProductId: checkoutProduct.id,
                  name: checkoutProduct.name,
                  price: checkoutProduct.price
                }
              : item;
          }));
        }
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
    setCartReady(true);
  }, []);

  useEffect(() => {
    if (cartReady) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems, cartReady]);

  const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_DELIVERY_MINIMUM ? 0 : 299;
  const discount = appliedCoupon === "ZAVI10" ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount + shipping;
  const freeDeliveryProgress = Math.min((subtotal / FREE_DELIVERY_MINIMUM) * 100, 100);

  function changeQuantity(itemId: string, change: number) {
    setCartItems((current) => current.map((item) => (
      item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + change) } : item
    )));
  }

  function removeItem(itemId: string) {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  }

  function applyCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedCoupon("");
      setCouponMessage("Enter a coupon code first.");
      setCouponMessageState("error");
      return;
    }
    if (normalizedCode !== "ZAVI10") {
      setAppliedCoupon("");
      setCouponMessage("That coupon code isn’t valid. Try ZAVI10 for 10% off.");
      setCouponMessageState("error");
      return;
    }
    setAppliedCoupon(normalizedCode);
    setCouponCode(normalizedCode);
    setCouponMessage("ZAVI10 applied — you saved 10% on your items.");
    setCouponMessageState("success");
  }

  function continueToCheckout() {
    if (!cartReady || cartItems.length === 0) return;
    const items = cartItems.map((item) => ({
      id: item.checkoutProductId ?? CHECKOUT_PRODUCTS_BY_CART_ID[item.id]?.id ?? null,
      quantity: item.quantity
    }));
    if (items.some((item) => item.id === null)) {
      setCheckoutMessage("One or more cart items are not available for checkout yet. Remove them and try again.");
      return;
    }

    const checkoutUrl = new URL("/checkout", window.location.origin);
    checkoutUrl.searchParams.set("cart", JSON.stringify(items));
    if (appliedCoupon) checkoutUrl.searchParams.set("coupon", appliedCoupon);
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
          <span className="store-brand-name">ZaviMart</span>
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

        {!cartItems.length ? (
          <section className="cart-empty-card">
            <h2>Your cart is empty</h2>
            <p>Browse the deals and add something you love.</p>
            <Link className="cart-empty-link" href="/#deals">Browse deals</Link>
          </section>
        ) : (
          <div className="cart-page-layout">
            <div className="cart-main-column">
              <section className="delivery-progress-card" aria-label="Free delivery progress">
                <div className="delivery-progress-heading">
                  <span className="delivery-truck-icon"><Truck size={20} aria-hidden="true" /></span>
                  <div>
                    <h2>{subtotal >= FREE_DELIVERY_MINIMUM ? "You’ve unlocked free delivery" : `Add Rs ${(FREE_DELIVERY_MINIMUM - subtotal).toLocaleString("en-PK")} for free delivery`}</h2>
                    <p>Free delivery on orders of Rs {FREE_DELIVERY_MINIMUM.toLocaleString("en-PK")} or more</p>
                  </div>
                  <strong>{Math.round(freeDeliveryProgress)}%</strong>
                </div>
                <div className="delivery-progress-track" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(freeDeliveryProgress)} role="progressbar">
                  <span style={{ width: `${freeDeliveryProgress}%` }} />
                </div>
              </section>

              <section className="cart-product-list" aria-label="Cart products">
                {cartItems.map((item) => (
                  <article className="cart-product-card" key={item.id}>
                    <div className="cart-product-image">
                      <Image src={item.image} alt={item.name} fill sizes="80px" unoptimized />
                    </div>
                    <div className="cart-product-details">
                      <h2>{item.name}</h2>
                      <span className="cart-product-unit">Rs {item.price.toLocaleString("en-PK")} each</span>
                      <div className="cart-product-controls">
                        <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                          <button type="button" aria-label={`Decrease ${item.name} quantity`} onClick={() => changeQuantity(item.id, -1)}>
                            <Minus size={15} aria-hidden="true" />
                          </button>
                          <span aria-live="polite">{item.quantity}</span>
                          <button type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => changeQuantity(item.id, 1)}>
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
              {discount > 0 && (
                <div className="summary-line coupon-discount">
                  <span>Discount (ZAVI10)</span>
                  <strong>- Rs {discount.toLocaleString("en-PK")}</strong>
                </div>
              )}
              <div className="summary-line">
                <span>Shipping</span>
                <strong className={shipping === 0 ? "shipping-free" : ""}>{shipping === 0 ? "FREE" : `Rs ${shipping.toLocaleString("en-PK")}`}</strong>
              </div>
              <div className="summary-line summary-total">
                <span>Total</span>
                <strong>Rs {total.toLocaleString("en-PK")}</strong>
              </div>

              <form className="coupon-form" onSubmit={applyCoupon}>
                <label htmlFor="couponCode">Coupon code</label>
                <div className="coupon-input-row">
                  <input
                    id="couponCode"
                    type="text"
                    value={couponCode}
                    onChange={(event) => {
                      setCouponCode(event.target.value);
                      setAppliedCoupon("");
                      setCouponMessage("");
                      setCouponMessageState("");
                    }}
                    placeholder="Try ZAVI10"
                    aria-describedby="couponMessage"
                  />
                  <button type="submit">APPLY</button>
                </div>
                <p
                  className="coupon-message"
                  id="couponMessage"
                  data-state={couponMessageState}
                  role="status"
                  aria-live="polite"
                >
                  {couponMessage}
                </p>
              </form>

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
