"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Clock, Heart, X } from "lucide-react";
import { toast } from "sonner";
import type { Swiper as SwiperInstance } from "swiper";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { addCartItem, readCart, saveCart } from "../lib/cart";
import ProductCard from "./ProductCard";

export type Deal = {
  id: string;
  name: string;
  category: string;
  categoryName?: string;
  categoryId?: string;
  departmentId?: string;
  departmentName?: string;
  image: string;
  images?: string[];
  oldPrice: number;
  badge: string;
  price?: number;
  originalPrice?: number | null;
  imagePriority?: boolean;
  priority?: number;
  customTitle?: string;
  hotDealId?: string;
  dealType?: "single" | "bundle";
  bundleImages?: string[];
  bundleImage?: string;
};

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  productsCount?: number;
  departmentId?: string;
  departmentName?: string;
};

type ValueSetItem = { title: string; image: string; price: number };
type ValueSet = {
  _id: string;
  name: string;
  tag: string;
  images: string[];
  items: ValueSetItem[];
  setPrice: number;
  valuePrice: number;
  savings: number;
  timerExpiry: string;
  stockTotal: number;
  stockClaimed: number;
};

type HotDealsSliderProps = {
  categoryFilter: string;
  searchQuery: string;
  products: Deal[];
  productsLoading?: boolean;
  flashDealsLoading?: boolean;
  flashDeals?: Deal[];
  curatedHotDeals?: Deal[];
  newArrivals?: Deal[];
  categories: StoreCategory[];
  onAddToCart: (deal: Deal) => void;
  onSelectCategory: (category: string) => void;
};

function categoryMatches(deal: Deal, category: StoreCategory): boolean {
  const value = deal.category.trim().toLocaleLowerCase();
  if (deal.categoryId === category.id) return true;
  return value === category.id.toLocaleLowerCase() ||
    value === category.slug.toLocaleLowerCase() ||
    value === category.name.trim().toLocaleLowerCase();
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function ValueSetCountdown({ expiry }: { expiry: string }) {
  const [remaining, setRemaining] = useState(() => Date.parse(expiry) - Date.now());
  useEffect(() => {
    const update = () => setRemaining(Date.parse(expiry) - Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiry]);
  return (
    <span className="value-set-countdown">
      <Clock size={14} aria-hidden="true" /> {remaining > 0 ? formatCountdown(remaining) : "Ended"}
    </span>
  );
}

function ValueSetsSection() {
  const [bundles, setBundles] = useState<ValueSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [selectedBundle, setSelectedBundle] = useState<ValueSet | null>(null);
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/bundles", { cache: "no-store" });
        if (!response.ok) throw new Error("Value Sets are temporarily unavailable.");
        const result: unknown = await response.json();
        if (!Array.isArray(result)) throw new Error("The Value Sets service returned an invalid response.");
        if (active) setBundles(result as ValueSet[]);
      } catch (error) {
        console.error("Could not load Value Sets.", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (!loading && bundles.length === 0) return null;

  async function addSetToBag(bundle: ValueSet, goToCart = false) {
    if (savingId) return;
    setSavingId(bundle._id);
    const previousCart = readCart();
    try {
      const nextCart = addCartItem(previousCart, {
        id: `value-set:${bundle._id}`,
        bundleId: bundle._id,
        name: `${bundle.name} — Value Set`,
        image: bundle.images[0] || bundle.items[0]?.image || "",
        price: bundle.setPrice
      });
      saveCart(nextCart);
      const response = await fetch("/api/bundles/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bundle._id })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "This Value Set could not be reserved.";
        throw new Error(message);
      }
      if (typeof result === "object" && result !== null && "bundle" in result) {
        setBundles((current) => current.map((item) =>
          item._id === bundle._id ? result.bundle as ValueSet : item
        ).filter((item) => item.stockClaimed < item.stockTotal && Date.parse(item.timerExpiry) > Date.now()));
      }
      toast.success(`${bundle.name} added to your bag.`);
      setSelectedBundle(null);
      if (goToCart) window.location.assign("/cart");
    } catch (error) {
      saveCart(previousCart);
      const message = error instanceof Error ? error.message : "This Value Set could not be added to your bag.";
      toast.error(message);
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="value-sets-section" aria-label="Value Sets">
      <div className="value-sets-heading">
        <div>
          <span className="section-eyebrow">CURATED BEAUTY · LIMITED-TIME VALUE</span>
          <h2>Value Sets</h2>
        </div>
      </div>
      {loading ? (
        <div className="value-set-grid value-set-skeleton-grid" aria-label="Loading Value Sets" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => <div className="value-set-skeleton" key={index} />)}
        </div>
      ) : (
        <div className="value-set-grid">
          {bundles.map((bundle) => {
            const images = bundle.images.length
              ? bundle.images.slice(0, 2)
              : bundle.items.slice(0, 2).map((item) => item.image).filter(Boolean);
            const image = images[0] || bundle.items[0]?.image || "";
            const claimedPercent = bundle.stockTotal > 0
              ? Math.min(100, Math.round(bundle.stockClaimed / bundle.stockTotal * 100))
              : 0;
            const left = Math.max(0, bundle.stockTotal - bundle.stockClaimed);
            return (
              <article className="value-set-card" key={bundle._id}>
                <div className="value-set-photo">
                  {images.length > 1 ? (
                    <div className="value-set-photo-images">
                      {images.map((photo, index) => <img src={photo} alt={index === 0 ? bundle.name : ""} loading="lazy" key={`${photo}-${index}`} />)}
                    </div>
                  ) : image
                    ? <img src={image} alt={bundle.name} loading="lazy" />
                    : <span className="value-set-no-image">Curated Value Set</span>}
                  <span className="value-set-tag">{bundle.tag}</span>
                  <span className="value-set-savings-badge">SAVE {money(bundle.savings)}</span>
                  <button
                    className={`value-set-heart ${wishlisted[bundle._id] ? "is-wishlisted" : ""}`}
                    type="button"
                    aria-label={wishlisted[bundle._id] ? "Remove Value Set from favorites" : "Add Value Set to favorites"}
                    aria-pressed={!!wishlisted[bundle._id]}
                    onClick={() => setWishlisted((current) => ({ ...current, [bundle._id]: !current[bundle._id] }))}
                  >
                    <Heart size={19} fill={wishlisted[bundle._id] ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                  <ValueSetCountdown expiry={bundle.timerExpiry} />
                </div>
                <div className="value-set-content">
                  <h3>{bundle.name}</h3>
                  <button className="value-set-inside-link" type="button" onClick={() => setSelectedBundle(bundle)}>
                    View What’s Inside <span aria-hidden="true">→</span>
                  </button>
                  <div className="value-set-items-preview" aria-label={`${bundle.items.length} items in this set`}>
                    {bundle.items.slice(0, 3).map((item, index) => (
                      <span key={`${item.title}-${index}`}>
                        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="value-set-avatar-empty" />}
                      </span>
                    ))}
                    {bundle.items.length > 3 && <small>+{bundle.items.length - 3}</small>}
                  </div>
                  <div className="value-set-price-row">
                    <strong>{money(bundle.setPrice)}</strong><del>{money(bundle.valuePrice)}</del>
                  </div>
                  <p className="value-set-you-save">You save {money(bundle.savings)}</p>
                  <div className="value-set-stock">
                    <span className="value-set-stock-copy"><i /> {left} sets left <span>•</span> {claimedPercent}% claimed</span>
                    <span className="value-set-stock-track"><span style={{ width: `${claimedPercent}%` }} /></span>
                  </div>
                  <button
                    className="value-set-add"
                    type="button"
                    disabled={savingId === bundle._id || left < 1}
                    onClick={() => void addSetToBag(bundle)}
                  >
                    {savingId === bundle._id ? "Adding…" : left < 1 ? "Sold Out" : "Add Set to Bag"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {selectedBundle && (
        <div className="value-set-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedBundle(null);
        }}>
          <section className="value-set-modal" role="dialog" aria-modal="true" aria-labelledby="value-set-modal-title">
            <button className="value-set-modal-close" type="button" aria-label="Close set details" onClick={() => setSelectedBundle(null)}><X size={20} /></button>
            <span className="section-eyebrow">{selectedBundle.tag}</span>
            <h2 id="value-set-modal-title">{selectedBundle.name}</h2>
            <p className="value-set-modal-subtitle">What’s inside this curated set</p>
            <ul className="value-set-modal-items">
              {selectedBundle.items.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="value-set-modal-placeholder" />}
                  <span>{item.title}</span><strong>{money(item.price)}</strong>
                </li>
              ))}
            </ul>
            <div className="value-set-modal-total"><span>Total value</span><del>{money(selectedBundle.valuePrice)}</del></div>
            <div className="value-set-modal-price"><span>Set price</span><strong>{money(selectedBundle.setPrice)}</strong></div>
            <p className="value-set-modal-savings">You save {money(selectedBundle.savings)}</p>
            <div className="value-set-modal-actions">
              <button type="button" className="value-set-modal-add" disabled={savingId === selectedBundle._id} onClick={() => void addSetToBag(selectedBundle)}>
                Add to Bag
              </button>
              <button type="button" className="value-set-modal-buy" disabled={savingId === selectedBundle._id} onClick={() => void addSetToBag(selectedBundle, true)}>
                Buy Set
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function money(value: number): string {
  return `Rs ${value.toLocaleString("en-PK")}`;
}

export default function HotDealsSlider({
  categoryFilter,
  searchQuery,
  products,
  productsLoading = false,
  flashDealsLoading = false,
  flashDeals = [],
  curatedHotDeals = [],
  newArrivals = [],
  categories,
  onAddToCart,
  onSelectCategory
}: HotDealsSliderProps) {
  const [addedDeals, setAddedDeals] = useState<Set<string>>(() => new Set());
  const swiperRefs = useRef<Record<string, SwiperInstance | null>>({});
  const hotDeals = curatedHotDeals
    .slice()
    .sort((left, right) => (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER));
  const dealGroups = [
    { title: "Flash Deals", label: "Limited-time prices", deals: flashDeals },
    { title: "Hot Deals", label: "Popular right now", deals: hotDeals },
    ...(newArrivals.length ? [{ title: "New Arrivals", label: "Just arrived", deals: newArrivals }] : [])
  ];
  const searchTerms = searchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const categoryGroups = categories
    .map((category) => ({
      category,
      deals: products.filter((deal) => {
        if (!categoryMatches(deal, category)) return false;
        const searchableText = `${deal.name} ${deal.category} ${deal.badge}`.toLocaleLowerCase();
        return searchTerms.every((term) => searchableText.includes(term));
      })
    }))
    .filter((group) => group.deals.length > 0)
    .filter((group) => !categoryFilter || group.category.id === categoryFilter);

  return (
    <div className="deal-sections" id="deals">
      {dealGroups.map((group, groupIndex) => {
        const visibleDeals = group.deals.filter((deal) => {
          const selectedCategory = categories.find((category) => category.id === categoryFilter);
          const matchesCategory = !categoryFilter || !!selectedCategory && categoryMatches(deal, selectedCategory);
          const searchableText = `${deal.name} ${deal.category} ${deal.badge}`.toLowerCase();
          const matchesSearch = searchTerms.every((term) => searchableText.includes(term));
          return matchesCategory && matchesSearch;
        });

        return (
          <Fragment key={group.title}>
          {visibleDeals.length > 0 ? <section
            className="deal-section"
            id={group.title === "New Arrivals" ? "new-arrivals" : undefined}
            aria-label={group.title}
          >
            <div className="deal-section-heading">
              <div>
                <span className="section-eyebrow">{group.label}</span>
                <h2>{group.title}</h2>
              </div>
              <div className="deal-heading-actions">
                <div className="deal-navigation" aria-label={`${group.title} navigation`}>
                  <button
                    className="deal-nav-button"
                    type="button"
                    aria-label={`Previous ${group.title.toLowerCase()}`}
                    disabled={visibleDeals.length < 2}
                    onClick={() => swiperRefs.current[group.title]?.slidePrev()}
                  >
                    ‹
                  </button>
                  <button
                    className="deal-nav-button"
                    type="button"
                    aria-label={`Next ${group.title.toLowerCase()}`}
                    disabled={visibleDeals.length < 2}
                    onClick={() => swiperRefs.current[group.title]?.slideNext()}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            {visibleDeals.length > 0 ? (
              <Swiper
                className="deals-swiper"
                modules={[Autoplay, Pagination]}
                onSwiper={(swiper) => {
                  swiperRefs.current[group.title] = swiper;
                }}
                pagination={{ clickable: true }}
                autoplay={{ delay: 3200, disableOnInteraction: false, pauseOnMouseEnter: true }}
                loop={visibleDeals.length > 3}
                spaceBetween={16}
                slidesPerView={1.15}
                breakpoints={{
                  560: { slidesPerView: 2.1, spaceBetween: 18 },
                  820: { slidesPerView: 3, spaceBetween: 20 },
                  1120: { slidesPerView: 4, spaceBetween: 22 }
                }}
              >
                {visibleDeals.map((deal) => {
                  const isAdded = addedDeals.has(deal.id);
                  const dealCategory = categories.find((category) => category.id === deal.categoryId);

                  return (
                    <SwiperSlide key={deal.id}>
                      <ProductCard
                        product={{
                          id: deal.id,
                          title: deal.customTitle || deal.name,
                          category: deal.dealType === "bundle"
                            ? `${deal.bundleImages?.length ?? 2} Items Combo`
                            : [dealCategory?.departmentName ?? deal.departmentName, dealCategory?.name ?? deal.categoryName ?? deal.category].filter(Boolean).join(" • "),
                          image: deal.image,
                          images: deal.images,
                          price: deal.price,
                          originalPrice: deal.originalPrice,
                          sellingPrice: deal.price,
                          badge: deal.dealType === "bundle" ? `Pack of ${deal.bundleImages?.length ?? 2}` : deal.badge,
                          href: deal.dealType === "bundle" && deal.hotDealId
                            ? `/hot-deal/${encodeURIComponent(deal.hotDealId)}`
                            : undefined,
                          isBundle: deal.dealType === "bundle",
                          bundleImages: deal.bundleImages,
                          bundleImage: deal.bundleImage
                        }}
                        compact
                        priority={deal.imagePriority}
                        isAdded={isAdded}
                        onAddToCart={() => {
                          setAddedDeals((current) => new Set(current).add(deal.id));
                          onAddToCart(deal);
                        }}
                      />
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            ) : null}
          </section>
          : group.title === "Flash Deals" && flashDealsLoading ? (
            <section className="deal-section" aria-label="Loading Flash Deals" aria-busy="true">
              <div className="deal-section-heading"><h2>Flash Deals</h2></div>
              <div className="flash-deal-skeleton-row">
                {Array.from({ length: 5 }, (_, index) => <div className="flash-deal-skeleton" key={index} />)}
              </div>
            </section>
          ) : null}
          {groupIndex === 0 && <ValueSetsSection />}
          </Fragment>
        );
      })}
      <div className="category-product-rows" aria-label="Shop products by category">
        {categoryGroups.map((group) => (
          <section className="category-product-row" key={group.category.id} aria-label={`${group.category.name} products`}>
            <div className="category-product-heading">
              <div>
                {group.category.departmentName && <span className="category-product-department">{group.category.departmentName}</span>}
                <h2>{group.category.name}</h2>
              </div>
              <a
                href="#deals"
                onClick={(event) => {
                  event.preventDefault();
                  onSelectCategory(group.category.id);
                }}
              >
                See All <span aria-hidden="true">→</span>
              </a>
            </div>
            <div
              className="category-product-scroller scrollbar-hide"
              aria-label={`Scroll ${group.category.name} products`}
              tabIndex={0}
            >
              {group.deals.map((deal) => {
                const isAdded = addedDeals.has(deal.id);
                const dealCategory = categories.find((category) => category.id === deal.categoryId);
                return (
                  <div className="category-product-item" key={deal.id}>
                    <ProductCard
                      compact
                      product={{
                        id: deal.id,
                        title: deal.customTitle || deal.name,
                        category: deal.dealType === "bundle"
                          ? `${deal.bundleImages?.length ?? 2} Items Combo`
                          : [dealCategory?.departmentName ?? deal.departmentName, dealCategory?.name ?? deal.categoryName ?? deal.category].filter(Boolean).join(" • "),
                        image: deal.image,
                        images: deal.images,
                        price: deal.price,
                        originalPrice: deal.originalPrice,
                        sellingPrice: deal.price,
                        badge: deal.dealType === "bundle" ? `Pack of ${deal.bundleImages?.length ?? 2}` : deal.badge,
                        href: deal.dealType === "bundle" && deal.hotDealId
                          ? `/hot-deal/${encodeURIComponent(deal.hotDealId)}`
                          : undefined,
                        isBundle: deal.dealType === "bundle",
                        bundleImages: deal.bundleImages,
                        bundleImage: deal.bundleImage
                      }}
                      priority={deal.imagePriority}
                      isAdded={isAdded}
                      onAddToCart={() => {
                        setAddedDeals((current) => new Set(current).add(deal.id));
                        onAddToCart(deal);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {productsLoading ? (
        <section className="homepage-product-loading" aria-label="Loading products" aria-busy="true">
          <div className="deal-section-heading">
            <div><span className="section-eyebrow">Just for you</span><h2>Shop products</h2></div>
          </div>
          <div className="homepage-product-skeleton-grid">
            {Array.from({ length: 4 }, (_, index) => <div className="homepage-product-skeleton" key={index} />)}
          </div>
        </section>
      ) : products.length === 0 ? (
        <section className="homepage-products-empty" role="status">
          <span className="section-eyebrow">ZaviMart collection</span>
          <h2>No products available</h2>
          <p>There are no products to show right now. Please check back soon.</p>
        </section>
      ) : null}
      <p className="cart-feedback" aria-live="polite">
        {addedDeals.size > 0 ? `${addedDeals.size} ${addedDeals.size === 1 ? "deal" : "deals"} added to your cart.` : ""}
      </p>
    </div>
  );
}
