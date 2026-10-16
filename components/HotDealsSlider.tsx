"use client";

import { useRef, useState } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
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

type HotDealsSliderProps = {
  categoryFilter: string;
  searchQuery: string;
  products: Deal[];
  productsLoading?: boolean;
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

export default function HotDealsSlider({
  categoryFilter,
  searchQuery,
  products,
  productsLoading = false,
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
      {dealGroups.map((group) => {
        const visibleDeals = group.deals.filter((deal) => {
          const selectedCategory = categories.find((category) => category.id === categoryFilter);
          const matchesCategory = !categoryFilter || !!selectedCategory && categoryMatches(deal, selectedCategory);
          const searchableText = `${deal.name} ${deal.category} ${deal.badge}`.toLowerCase();
          const matchesSearch = searchTerms.every((term) => searchableText.includes(term));
          return matchesCategory && matchesSearch;
        });

        return (
          <section className="deal-section" key={group.title} aria-label={group.title}>
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
            ) : (
              <p className="deals-empty">No {group.title.toLowerCase()} in this category right now.</p>
            )}
          </section>
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
