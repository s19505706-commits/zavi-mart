"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth-context";
import {
  ChevronDown,
  Heart,
  ShoppingCart,
  UserRound,
  X
} from "lucide-react";
import HotDealsSlider, { type Deal, type StoreCategory } from "../components/HotDealsSlider";
import StoreSearch from "../components/StoreSearch";
import {
  CART_STORAGE_KEY,
  CHECKOUT_PRODUCTS_BY_CART_ID,
  addCartItem,
  readCart,
  saveCart,
  type CartItem
} from "../lib/cart";
import { readWishlist } from "../lib/wishlist";

const DEFAULT_SHIPPING_AMOUNT = 2999;
type StoreDepartment = { id: string; name: string; slug: string; image?: string; categories: StoreCategory[] };
const PLACEHOLDER_DEPARTMENTS = ["Beauty", "Fashion", "Electronics", "Home", "Accessories", "Wellness"];

function parseStoreDeals(value: unknown, fallbackBadge: string): Deal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Deal[] => {
    if (typeof entry !== "object" || entry === null ||
        !("_id" in entry) || typeof entry._id !== "string" ||
        !("title" in entry) || typeof entry.title !== "string" ||
        !("price" in entry) || typeof entry.price !== "number" ||
        !("category" in entry) || typeof entry.category !== "string") return [];
    const images = "images" in entry && Array.isArray(entry.images)
      ? entry.images.filter((image: unknown): image is string => typeof image === "string" && image.length > 0)
      : [];
    const image = "image" in entry && typeof entry.image === "string" && entry.image
      ? entry.image
      : images[0] ?? "";
    if (!image) return [];
    const originalPrice = "originalPrice" in entry && typeof entry.originalPrice === "number"
      ? entry.originalPrice
      : null;
    return [{
      id: entry._id,
      name: entry.title,
      category: entry.category,
      categoryId: "categoryId" in entry && typeof entry.categoryId === "string" ? entry.categoryId : undefined,
      departmentId: "departmentId" in entry && typeof entry.departmentId === "string" ? entry.departmentId : undefined,
      image,
      images: images.length ? images : [image],
      oldPrice: originalPrice ?? entry.price,
      price: entry.price,
      originalPrice,
      badge: "badge" in entry && typeof entry.badge === "string" && entry.badge
        ? entry.badge
        : fallbackBadge
    }];
  });
}

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Deal[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [flashDeals, setFlashDeals] = useState<Deal[]>([]);
  const [flashDealsLoading, setFlashDealsLoading] = useState(true);
  const [newArrivals, setNewArrivals] = useState<Deal[]>([]);
  const [curatedHotDeals, setCuratedHotDeals] = useState<Deal[]>([]);
  const [departmentCategories, setDepartmentCategories] = useState<StoreCategory[]>([]);
  const [departments, setDepartments] = useState<StoreDepartment[]>([]);
  const [shippingAmount, setShippingAmount] = useState(DEFAULT_SHIPPING_AMOUNT);
  const [shippingText, setShippingText] = useState("Free delivery above Rs 2,999 | COD Available");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signInMessage, setSignInMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { user, signIn } = useAuth();
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("message") === "Access Denied") {
      setAccessDenied(true);
    }
  }, []);

  useEffect(() => {
    const updateWishlistCount = () => {
      try {
        setWishlistCount(readWishlist().length);
      } catch (error) {
        console.error("Could not read the wishlist count.", error);
      }
    };
    updateWishlistCount();
    window.addEventListener("storage", updateWishlistCount);
    window.addEventListener("zavimart_wishlist_updated", updateWishlistCount);
    return () => {
      window.removeEventListener("storage", updateWishlistCount);
      window.removeEventListener("zavimart_wishlist_updated", updateWishlistCount);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/departments", { cache: "no-store" })
      .then(async (departmentResponse) => {
      const departmentResult: unknown = await departmentResponse.json();
      if (!departmentResponse.ok ||
          typeof departmentResult !== "object" || departmentResult === null ||
          !("departments" in departmentResult) || !Array.isArray(departmentResult.departments)) {
        throw new Error("The department API returned an invalid response.");
      }
      const loadedDepartments = departmentResult.departments.flatMap((entry): StoreDepartment[] => {
        if (typeof entry !== "object" || entry === null ||
            !("id" in entry) || typeof entry.id !== "string" ||
            !("name" in entry) || typeof entry.name !== "string" ||
            !("slug" in entry) || typeof entry.slug !== "string" ||
            !("categories" in entry) || !Array.isArray(entry.categories)) return [];
        const categories = entry.categories.flatMap((category: unknown): StoreCategory[] =>
          typeof category === "object" && category !== null &&
            "id" in category && typeof category.id === "string" &&
            "name" in category && typeof category.name === "string" &&
            "slug" in category && typeof category.slug === "string"
            ? [{
              id: category.id,
              name: category.name,
              slug: category.slug,
              departmentId: entry.id,
              departmentName: entry.name
            }]
            : []
        );
        return [{
          id: entry.id,
          name: entry.name,
          slug: entry.slug,
          image: "image" in entry && typeof entry.image === "string" ? entry.image : undefined,
          categories
        }];
      });
      const loadedCategories = loadedDepartments.flatMap((department) => department.categories);
      if (!cancelled) {
        setDepartments(loadedDepartments);
        setDepartmentCategories(loadedCategories);
      }
    })
      .catch((error: unknown) => {
        if (!cancelled) console.error("Could not load storefront categories.", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPromotions() {
      const arrivalsRequest = fetch("/api/products?new=true&limit=10", { cache: "no-store" })
        .then(async (response) => {
          const result: unknown = await response.json();
          if (!response.ok || typeof result !== "object" || result === null ||
              !("products" in result) || !Array.isArray(result.products)) {
            throw new Error("The new arrivals API returned an invalid response.");
          }
          if (!cancelled) setNewArrivals(parseStoreDeals(result.products, "New").slice(0, 10));
        });

      try {
        const response = await fetch("/api/flash-deals", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || typeof result !== "object" || result === null ||
            !("products" in result) || !Array.isArray(result.products)) {
          throw new Error("The flash deals API returned an invalid response.");
        }
        let deals = parseStoreDeals(result.products, "Flash Sale");
        if (deals.length === 0) {
          const fallbackResponse = await fetch("/api/products?limit=6", { cache: "no-store" });
          const fallbackResult: unknown = await fallbackResponse.json();
          if (!fallbackResponse.ok || typeof fallbackResult !== "object" || fallbackResult === null ||
              !("products" in fallbackResult) || !Array.isArray(fallbackResult.products)) {
            throw new Error("Could not load products for the Flash Deals fallback.");
          }
          deals = parseStoreDeals(fallbackResult.products, "Featured");
        }
        if (!cancelled) setFlashDeals(deals.slice(0, 10));
      } catch (error) {
        if (!cancelled) console.error("Could not load homepage flash deals.", error);
      } finally {
        if (!cancelled) setFlashDealsLoading(false);
      }

      try {
        await arrivalsRequest;
      } catch (error) {
        if (!cancelled) console.error("Could not load homepage new arrivals.", error);
      }
    }

    void loadPromotions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hot-deals", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || typeof result !== "object" || result === null ||
            !("products" in result) || !Array.isArray(result.products)) {
          throw new Error("The hot deals API returned an invalid response.");
        }
        const loadedDeals = result.products.flatMap((entry): Deal[] => {
          if (typeof entry !== "object" || entry === null ||
              !("hotDealId" in entry) || typeof entry.hotDealId !== "string" ||
              !("_id" in entry) || typeof entry._id !== "string" ||
              !("title" in entry) || typeof entry.title !== "string" ||
              !("price" in entry) || typeof entry.price !== "number" ||
              !("category" in entry) || typeof entry.category !== "string") return [];
          const bundleImages = "dealProducts" in entry && Array.isArray(entry.dealProducts)
            ? entry.dealProducts.flatMap((product: unknown) =>
              typeof product === "object" && product !== null && "image" in product && typeof product.image === "string"
                ? [product.image]
                : []
            )
            : [];
          const image = "image" in entry && typeof entry.image === "string" ? entry.image : "";
          if (!image) return [];
          return [{
            id: entry._id,
            name: "bundleTitle" in entry && typeof entry.bundleTitle === "string" && entry.bundleTitle
              ? entry.bundleTitle
              : entry.title,
            category: "categoryId" in entry && typeof entry.categoryId === "string"
              ? entry.categoryId
              : entry.category.toLocaleLowerCase(),
            image,
            images: "bundleImage" in entry && typeof entry.bundleImage === "string" && entry.bundleImage
              ? [image]
              : bundleImages.length ? bundleImages : [image],
            bundleImages,
            bundleImage: "bundleImage" in entry && typeof entry.bundleImage === "string" ? entry.bundleImage : "",
            hotDealId: "hotDealId" in entry && typeof entry.hotDealId === "string" ? entry.hotDealId : undefined,
            dealType: "dealType" in entry && entry.dealType === "bundle" ? "bundle" as const : "single" as const,
            oldPrice: "originalPrice" in entry && typeof entry.originalPrice === "number"
              ? entry.originalPrice
              : entry.price,
            price: entry.price,
            originalPrice: "originalPrice" in entry && typeof entry.originalPrice === "number"
              ? entry.originalPrice
              : null,
            badge: "badge" in entry && typeof entry.badge === "string" ? entry.badge : "Hot Deal",
            priority: "priority" in entry && typeof entry.priority === "number" ? entry.priority : undefined,
            customTitle: "customTitle" in entry && typeof entry.customTitle === "string" ? entry.customTitle : ""
          }];
        });
        if (!cancelled) setCuratedHotDeals(loadedDeals);
      })
      .catch((error: unknown) => {
        if (!cancelled) console.error("Could not load curated hot deals.", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function syncCart() {
      try {
        const items = readCart();
        setCartItems((current) => JSON.stringify(current) === JSON.stringify(items) ? current : items);
      } catch (error) {
        console.error("Could not restore the storefront cart.", error);
        localStorage.removeItem(CART_STORAGE_KEY);
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
    if (cartReady) {
      try {
        saveCart(cartItems);
      } catch (error) {
        console.error("Could not persist the storefront cart.", error);
        toast.error("Your cart could not be saved. Please try again.");
      }
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

        const deals: Deal[] = result.products.flatMap((entry, index): Deal[] => {
          if (
            typeof entry !== "object" ||
            entry === null ||
            !("_id" in entry) ||
            typeof entry._id !== "string" ||
            !("title" in entry) ||
            typeof entry.title !== "string" ||
            !("price" in entry) ||
            typeof entry.price !== "number" ||
            !("category" in entry) ||
            typeof entry.category !== "string"
          ) {
            return [];
          }
          const image = "image" in entry && typeof entry.image === "string"
            ? entry.image
            : "images" in entry && Array.isArray(entry.images) && typeof entry.images[0] === "string"
              ? entry.images[0]
              : "";
          if (!image) {
            console.error(`Product "${entry.title}" has no usable image and was omitted from the storefront.`);
            return [];
          }
          const categoryId = "categoryId" in entry && typeof entry.categoryId === "string" ? entry.categoryId : "";
          const categoryOption = departmentCategories.find((item) => item.id === categoryId);
          const departmentId = "departmentId" in entry && typeof entry.departmentId === "string" ? entry.departmentId : "";
          const category = categoryId || entry.category.toLocaleLowerCase();
          const originalPrice = "originalPrice" in entry && typeof entry.originalPrice === "number"
            ? entry.originalPrice
            : null;
          const images = "images" in entry && Array.isArray(entry.images)
            ? entry.images.filter((candidate: unknown): candidate is string => typeof candidate === "string" && candidate.length > 0)
            : [image];
          const isNewArrival = "isNewArrival" in entry && entry.isNewArrival === true;
          return [{
            id: entry._id,
            name: entry.title,
            category,
            categoryId: categoryId || undefined,
            categoryName: categoryOption?.name ?? entry.category,
            departmentId: departmentId || undefined,
            departmentName: categoryOption?.departmentName,
            image,
            images,
            oldPrice: originalPrice ?? entry.price,
            price: entry.price,
            originalPrice,
            imagePriority: index < 4,
            badge: isNewArrival ? "New" : ""
          }];
        });
        if (!cancelled) setProducts(deals);
      })
      .catch((error: unknown) => {
        console.error("Could not load products for the homepage.", error);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshShippingText() {
      try {
        const response = await fetch("/api/shipping", { cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok || typeof data !== "object" || data === null || Array.isArray(data)) {
          throw new Error("Could not load the current delivery threshold.");
        }

        if (!("minAmountForFree" in data) ||
            typeof data.minAmountForFree !== "number" ||
            !Number.isFinite(data.minAmountForFree)) {
          throw new Error("The shipping API returned an invalid free-delivery threshold.");
        }

        const bannerText = "bannerText" in data && typeof data.bannerText === "string"
          ? data.bannerText.trim()
          : "";

        if (cancelled) return;
        const amount = data.minAmountForFree;
        setShippingAmount(amount);
        const formattedAmount = amount.toLocaleString("en-US");
        const standardBanner = /^Free delivery (?:above|on orders above) Rs [\d,]+$/i.test(bannerText);
        const customBanner = /\bRs\b/i.test(bannerText) && !standardBanner
          ? bannerText
          : `Free delivery above Rs ${formattedAmount}`;
        setShippingText(/\|\s*COD Available\s*$/i.test(customBanner)
          ? customBanner
          : `${customBanner} | COD Available`);
      } catch (error) {
        if (!cancelled) console.error("Could not refresh the storefront delivery banner.", error);
      }
    }

    const handleShippingUpdated = () => {
      void refreshShippingText();
    };

    void refreshShippingText();
    window.addEventListener("shipping_updated", handleShippingUpdated);
    window.addEventListener("storage", handleShippingUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("shipping_updated", handleShippingUpdated);
      window.removeEventListener("storage", handleShippingUpdated);
    };
  }, []);

  const heroProduct = products[0];

  return (
    <main className="storefront-page">
      {accessDenied && <p className="sign-in-status" role="alert">Access Denied</p>}
      <div className="store-topbar">
        <span className="announcement-live">
          <span className="announcement-live-dot" aria-hidden="true" />
          <span>LIVE</span>
        </span>
        <span className="announcement-copy" data-shipping-amount={shippingAmount}>{shippingText}</span>
      </div>

      <header className="store-header">
        <a className="store-brand" href="#top" id="top" aria-label="ZaviMart home">
          <span className="store-brand-cart" aria-hidden="true">
            <ShoppingCart size={34} strokeWidth={2.2} />
            <span className="store-brand-cart-accent" />
          </span>
          <span className="store-brand-name"><span>Zavi</span><span>Mart</span></span>
        </a>
        <StoreSearch value={searchQuery} onChange={setSearchQuery} />
        <div className="header-actions">
          <Link
            className="header-icon-button"
            href="/wishlist"
            aria-label={`Wishlist, ${wishlistCount} items`}
          >
            <Heart size={20} strokeWidth={1.9} aria-hidden="true" />
            {wishlistCount > 0 && <span className="cart-item-count">{wishlistCount}</span>}
          </Link>
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

      <nav className="department-mega-nav" aria-label="Shop departments">
        <details className="department-menu">
          <summary>
            <span>Departments</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="department-menu-panel">
            {departments.map((department) => {
              const childCategories = departmentCategories.filter((category) => category.departmentId === department.id);
              return (
                <div className="department-menu-row" key={department.id}>
                  <Link className="department-menu-name" href={`/department/${encodeURIComponent(department.slug)}`}>
                    {department.name}
                  </Link>
                  <div className="department-menu-categories">
                    {childCategories.map((category) => (
                      <Link key={category.id} href={`/department/${encodeURIComponent(department.slug)}/${encodeURIComponent(category.slug)}`}>
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
        <Link href="#top">Home</Link>
        <Link href="#flash-deals-section">Flash Deals</Link>
        <Link href="#deals">Hot Deals</Link>
        <Link href="#new-arrivals">New Arrivals</Link>
        <Link href="/contact">Contact</Link>
      </nav>

      <section className="luxury-hero" aria-labelledby="hero-heading">
        <div className="luxury-hero-glow luxury-hero-glow-primary" aria-hidden="true" />
        <div className="luxury-hero-glow luxury-hero-glow-secondary" aria-hidden="true" />
        <div className="luxury-hero-inner">
          <div className="luxury-hero-copy">
            <span className="luxury-hero-kicker">NEW COLLECTION 2026</span>
            <h1 id="hero-heading">
              <span>Timeless Luxury,</span>
              <br />
              Redefined
            </h1>
            <p>Discover curated perfumes, fashion &amp; beauty — crafted for the modern luxury lifestyle. Authentic guaranteed.</p>
            <div className="luxury-hero-actions">
              <Link href="/search" className="luxury-button-primary">Shop Now</Link>
              <a href="#departments" className="luxury-button-secondary">Explore Collections</a>
            </div>
            <div className="luxury-hero-promises">
              <span><i aria-hidden="true">✓</i> Authentic Guaranteed</span>
              <span><i aria-hidden="true">↩</i> Free Returns 30 Days</span>
            </div>
          </div>
          <div className="luxury-hero-feature">
            <div className="luxury-hero-feature-glow" aria-hidden="true" />
            <div className="luxury-hero-product-image">
              <img
                src={heroProduct?.image || "/placeholder.svg"}
                alt={heroProduct?.name || "Featured ZaviMart product"}
                fetchPriority="high"
              />
            </div>
            <div className="luxury-hero-product-caption">
              <div>
                <strong>{heroProduct?.name || "The ZaviMart Edit"}</strong>
                <span>{heroProduct?.categoryName || "Curated Luxury"}</span>
              </div>
              <b>{heroProduct ? `Rs ${heroProduct.price?.toLocaleString("en-PK")}` : "New arrivals"}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="luxury-departments" id="departments" aria-labelledby="departments-heading">
        <div className="luxury-section-heading">
          <span className="section-eyebrow">THE ZAVIMART EDIT</span>
          <h2 id="departments-heading">Shop by Departments</h2>
          <p>Explore our curated categories</p>
        </div>
        {departments.length === 0 && !productsLoading ? (
          <div className="luxury-department-grid">
            {PLACEHOLDER_DEPARTMENTS.map((name) => (
              <div className="luxury-department-card luxury-department-placeholder" key={name}>
                <div className="luxury-department-image"><img src="/placeholder.svg" alt="" loading="lazy" /></div>
                <div className="luxury-department-name">{name}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="luxury-department-grid">
            {departments.length > 0 ? departments.map((department) => (
              <Link
                className="luxury-department-card"
                key={department.id}
                href={`/department/${encodeURIComponent(department.slug)}`}
              >
                <div className="luxury-department-image">
                  <img src={department.image || "/placeholder.svg"} alt={department.name} loading="lazy" />
                </div>
                <div className="luxury-department-name">{department.name}</div>
              </Link>
            )) : Array.from({ length: 6 }, (_, index) => (
              <div className="luxury-department-card luxury-department-placeholder" key={`department-skeleton-${index}`} aria-hidden="true">
                <div className="luxury-department-image luxury-department-skeleton" />
                <div className="luxury-department-name luxury-department-skeleton-name" />
              </div>
            ))}
          </div>
        )}
      </section>

      <div id="flash-deals-section">
        <HotDealsSlider
          categoryFilter={activeCategory}
          searchQuery={searchQuery}
          products={products}
          productsLoading={productsLoading}
          flashDealsLoading={flashDealsLoading}
          flashDeals={flashDeals}
          curatedHotDeals={curatedHotDeals}
          newArrivals={newArrivals}
          categories={departmentCategories}
          onSelectCategory={(category) => {
            setActiveCategory(category);
            document.getElementById("flash-deals-section")?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }}
          onAddToCart={(deal: Deal) => {
            try {
              const checkoutProduct = CHECKOUT_PRODUCTS_BY_CART_ID[deal.id];
              const current = readCart();
              const next = addCartItem(current, {
                id: deal.id,
                ...(checkoutProduct ? { checkoutProductId: checkoutProduct.id } : {}),
                ...(!checkoutProduct ? { productId: deal.id } : {}),
                name: checkoutProduct?.name ?? deal.name,
                image: deal.image,
                price: checkoutProduct?.price ?? deal.price ?? 0
              });
              saveCart(next);
              setCartItems(next);
              toast.success(`${deal.name} added to your cart.`);
            } catch (error) {
              console.error("Could not add the product to the cart.", error);
              toast.error("This product could not be added to your cart.");
            }
          }}
        />
      </div>
      <div className="luxury-trust-bar">
        <p>AUTHENTIC <span>•</span> CURATED <span>•</span> LUXURY DELIVERY</p>
      </div>
      <footer className="store-footer">
        <Link className="store-footer-brand" href="/">ZaviMart</Link>
        <p>Smart shopping, delivered to your door.</p>
        <nav aria-label="Store information">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
