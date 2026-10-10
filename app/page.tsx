"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import {
  Cable,
  HeartPulse,
  House,
  Laptop,
  Search,
  Shirt,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Sparkles,
  UserRound,
  WashingMachine,
  X
} from "lucide-react";
import HotDealsSlider, { type Deal } from "../components/HotDealsSlider";
import {
  CART_STORAGE_KEY,
  CHECKOUT_PRODUCTS_BY_CART_ID,
  STARTER_CART_ITEMS,
  type CartItem
} from "../lib/cart";

const categories = [
  { id: "mobiles", label: "Mobiles", icon: Smartphone },
  { id: "mobile accessories", label: "Mobile Accessories", icon: Cable },
  { id: "electronics", label: "Electronics", icon: Laptop },
  { id: "fashion", label: "Fashion", icon: Shirt },
  { id: "home", label: "Home & Living", icon: House },
  { id: "beauty", label: "Beauty", icon: Sparkles },
  { id: "appliances", label: "Appliances", icon: WashingMachine },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "groceries", label: "Groceries", icon: ShoppingBasket }
];

export default function HomePage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newArrivals, setNewArrivals] = useState<Deal[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>(STARTER_CART_ITEMS);
  const [cartReady, setCartReady] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signInMessage, setSignInMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { user, signIn } = useAuth();
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    try {
      const savedItems = localStorage.getItem(CART_STORAGE_KEY);
      if (savedItems) {
        const parsedItems: unknown = JSON.parse(savedItems);
        if (Array.isArray(parsedItems)) setCartItems(parsedItems as CartItem[]);
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
    setCartReady(true);
  }, []);

  useEffect(() => {
    if (cartReady) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    }
  }, [cartItems, cartReady]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?limit=100", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Product request failed with status ${response.status}.`);
        const result: unknown = await response.json();
        if (typeof result !== "object" || result === null || !("products" in result) || !Array.isArray(result.products)) {
          throw new Error("The product API returned an invalid response.");
        }

        const deals: Deal[] = result.products.flatMap((entry): Deal[] => {
          if (
            typeof entry !== "object" ||
            entry === null ||
            !("isMarkazProduct" in entry) ||
            entry.isMarkazProduct !== true ||
            !("_id" in entry) ||
            typeof entry._id !== "string" ||
            !("title" in entry) ||
            typeof entry.title !== "string" ||
            !("price" in entry) ||
            typeof entry.price !== "number" ||
            !("categoryId" in entry) ||
            typeof entry.categoryId !== "string"
          ) {
            return [];
          }
          const image = "image" in entry && typeof entry.image === "string"
            ? entry.image
            : "images" in entry && Array.isArray(entry.images) && typeof entry.images[0] === "string"
              ? entry.images[0]
              : "";
          if (!image) return [];
          const originalPrice = "originalPrice" in entry && typeof entry.originalPrice === "number"
            ? entry.originalPrice
            : null;
          const rating = "rating" in entry && typeof entry.rating === "number" ? entry.rating : 0;
          const reviews = "reviews" in entry && typeof entry.reviews === "number" ? entry.reviews : 100;
          return [{
            id: entry._id,
            name: entry.title,
            category: entry.categoryId,
            image,
            oldPrice: originalPrice ?? entry.price,
            price: entry.price,
            originalPrice,
            rating,
            reviews,
            badge: "New",
            isSupplierProduct: true
          }];
        });
        if (!cancelled) setNewArrivals(deals);
      })
      .catch((error: unknown) => {
        console.error("Could not load new catalog products for the homepage.", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="storefront-page">
      <div className="store-topbar">
        <span className="announcement-live">
          <span className="announcement-live-dot" aria-hidden="true" />
          <span>LIVE</span>
        </span>
        <span className="announcement-copy">Free delivery above Rs 2,999 <span aria-hidden="true">|</span> COD Available</span>
      </div>

      <header className="store-header">
        <a className="store-brand" href="#top" id="top" aria-label="ZaviMart home">
          <span className="store-brand-cart" aria-hidden="true">
            <ShoppingCart size={34} strokeWidth={2.2} />
            <span className="store-brand-cart-accent" />
          </span>
          <span className="store-brand-name">ZaviMart</span>
        </a>
        <label className="header-search">
          <Search size={19} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search for products..."
            aria-label="Search for products"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <div className="header-actions">
          <Link
            className="header-icon-button header-cart-button"
            href="/cart"
            aria-label={`Cart, ${cartCount} items`}
          >
            <ShoppingCart size={21} strokeWidth={1.9} aria-hidden="true" />
            <span className="cart-item-count" aria-hidden="true">{cartCount}</span>
          </Link>
          <button
            className="header-icon-button"
            type="button"
            aria-label="User account"
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            onClick={() => {
              setSignInMessage("");
              setAccountOpen(true);
            }}
          >
            <UserRound size={21} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
      </header>

      {accountOpen && (
        <div className="panel-backdrop account-backdrop" onClick={() => setAccountOpen(false)}>
          <section
            className="account-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-panel-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">Customer account</span>
                <h2 id="account-panel-title">{user ? "You're signed in" : "Sign in to ZaviMart"}</h2>
              </div>
              <button className="panel-close" type="button" aria-label="Close account panel" onClick={() => setAccountOpen(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {user ? (
              <p className="account-intro">Signed in as {user.email}.</p>
            ) : (
              <>
                <p className="account-intro">Access your orders and saved products.</p>
                <form
                  className="sign-in-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!email.trim() || !password) {
                      setSignInMessage("Enter your email address and password.");
                      return;
                    }
                    try {
                      signIn({ email: email.trim() });
                      setSignInMessage("");
                    } catch (error) {
                      console.error("Unable to save the signed-in user.", error);
                      setSignInMessage("We couldn't save your sign-in. Please try again.");
                    }
                  }}
                >
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  <button className="account-dismiss" type="submit">Sign in</button>
                  <p className="sign-in-status" role="status" aria-live="polite">{signInMessage}</p>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      <section className="category-section" aria-labelledby="category-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Browse departments</span>
          <h1 id="category-heading">Shop by category</h1>
        </div>
        <div className="category-buttons">
          {categories.map((category) => {
            const isActive = activeCategory === category.id;
            const CategoryIcon = category.icon;
            return (
              <button
                className="category-button"
                type="button"
                key={category.id}
                aria-pressed={isActive}
                onClick={() => setActiveCategory(isActive ? "" : category.id)}
              >
                <span className="category-icon" aria-hidden="true"><CategoryIcon size={20} strokeWidth={1.8} /></span>
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <HotDealsSlider
        categoryFilter={activeCategory}
        searchQuery={searchQuery}
        newArrivals={newArrivals}
        onOpenProduct={(deal) => router.push(`/product/${encodeURIComponent(deal.id)}`)}
        onAddToCart={(deal: Deal) => {
          setCartItems((current) => {
            const existing = current.find((item) => item.id === deal.id);
            if (existing) {
              return current.map((item) => item.id === deal.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            const checkoutProduct = CHECKOUT_PRODUCTS_BY_CART_ID[deal.id];
            return [...current, {
              id: deal.id,
              checkoutProductId: checkoutProduct?.id,
              name: checkoutProduct?.name ?? deal.name,
              image: deal.image,
              price: checkoutProduct?.price ?? deal.price ?? 3499,
              quantity: 1
            }];
          });
        }}
      />
    </main>
  );
}
