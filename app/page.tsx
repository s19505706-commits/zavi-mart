"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth-context";
import {
  Cable,
  ChevronDown,
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
import HotDealsSlider, { type Deal, type StoreCategory } from "../components/HotDealsSlider";
import {
  CART_STORAGE_KEY,
  CHECKOUT_PRODUCTS_BY_CART_ID,
  addCartItem,
  readCart,
  saveCart,
  type CartItem
} from "../lib/cart";

const DEFAULT_SHIPPING_AMOUNT = 2999;
type StoreDepartment = { id: string; name: string; slug: string; image?: string; categories: StoreCategory[] };

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

const categoryIcons: Record<string, typeof Smartphone> = {
  mobiles: Smartphone,
  "mobile-accessories": Cable,
  electronics: Laptop,
  fashion: Shirt,
  home: House,
  "home-living": House,
  beauty: Sparkles,
  appliances: WashingMachine,
  health: HeartPulse,
  groceries: ShoppingBasket
};

export default function HomePage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Deal[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [flashDeals, setFlashDeals] = useState<Deal[]>([]);
  const [newArrivals, setNewArrivals] = useState<Deal[]>([]);
  const [curatedHotDeals, setCuratedHotDeals] = useState<Deal[]>([]);
  const [departmentCategories, setDepartmentCategories] = useState<StoreCategory[]>([]);
  const [departments, setDepartments] = useState<StoreDepartment[]>([]);
  const [shippingAmount, setShippingAmount] = useState(DEFAULT_SHIPPING_AMOUNT);
  const [shippingText, setShippingText] = useState("Free delivery above Rs 2,999 | COD Available");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
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
        console.log("Loaded storefront departments and linked categories.", {
          departments: loadedDepartments.length,
          categories: loadedCategories.length
        });
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
    Promise.all([
      fetch("/api/flash-deals", { cache: "no-store" }),
      fetch("/api/products?newArrivals=true&limit=10", { cache: "no-store" })
    ]).then(async ([flashResponse, arrivalsResponse]) => {
      const [flashResult, arrivalsResult]: unknown[] = await Promise.all([
        flashResponse.json(),
        arrivalsResponse.json()
      ]);
      if (!flashResponse.ok || typeof flashResult !== "object" || flashResult === null ||
          !("products" in flashResult) || !Array.isArray(flashResult.products)) {
        throw new Error("The flash deals API returned an invalid response.");
      }
      if (!arrivalsResponse.ok || typeof arrivalsResult !== "object" || arrivalsResult === null ||
          !("products" in arrivalsResult) || !Array.isArray(arrivalsResult.products)) {
        throw new Error("The new arrivals API returned an invalid response.");
      }
      if (!cancelled) {
        setFlashDeals(parseStoreDeals(flashResult.products, "Flash Sale"));
        setNewArrivals(parseStoreDeals(arrivalsResult.products, "New").slice(0, 10));
      }
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Could not load homepage flash deals and new arrivals.", error);
    });
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
    try {
      setCartItems(readCart());
    } catch (error) {
      console.error("Could not restore the storefront cart.", error);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
    setCartReady(true);
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
        <Link href="#flash-deals-section">Hot Deals</Link>
        <Link href="#flash-deals-section">New Arrivals</Link>
        <a href="mailto:support@zavimart.com">Contact</a>
      </nav>

      <section className="category-section" aria-labelledby="category-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Browse departments</span>
          <h1 id="category-heading">Shop by departments</h1>
        </div>
        <div className="category-buttons">
          {departments.map((department) => {
            const CategoryIcon = categoryIcons[department.slug] ?? Sparkles;
            return (
              <Link
                className="category-button"
                key={department.id}
                href={`/department/${encodeURIComponent(department.slug)}`}
              >
                <span className="category-icon" aria-hidden="true"><CategoryIcon size={20} strokeWidth={1.8} /></span>
                <span>{department.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div id="flash-deals-section">
        <HotDealsSlider
          categoryFilter={activeCategory}
          searchQuery={searchQuery}
          products={products}
          productsLoading={productsLoading}
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
    </main>
  );
}
