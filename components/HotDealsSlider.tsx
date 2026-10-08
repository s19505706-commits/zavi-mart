"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

export type Deal = {
  id: string;
  name: string;
  category: string;
  image: string;
  oldPrice: number;
  rating: number;
  badge: string;
};

type HotDealsSliderProps = {
  categoryFilter: string;
  searchQuery: string;
  onAddToCart: (deal: Deal) => void;
};

const flashDeals: Deal[] = [
  { id: "flash-mobile", name: "Samsung Galaxy A35 5G", category: "mobiles", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80", oldPrice: 4999, rating: 4.8, badge: "Flash deal" },
  { id: "flash-accessory", name: "Anker USB-C Fast Charger", category: "mobile accessories", image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80", oldPrice: 5299, rating: 4.7, badge: "Fast charging" },
  { id: "flash-electronics", name: "JBL Portable Speaker", category: "electronics", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80", oldPrice: 5999, rating: 4.8, badge: "Hot price" },
  { id: "flash-fashion", name: "Khaadi Printed Lawn Set", category: "fashion", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80", oldPrice: 4999, rating: 4.6, badge: "Season deal" },
  { id: "flash-home", name: "Premium Cotton Bedsheet", category: "home", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80", oldPrice: 5499, rating: 4.7, badge: "Home favorite" },
  { id: "flash-beauty", name: "Hydrating Face Serum", category: "beauty", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80", oldPrice: 4299, rating: 4.8, badge: "Beauty deal" },
  { id: "flash-appliances", name: "Compact Air Fryer", category: "appliances", image: "https://images.unsplash.com/photo-1585518419759-7fe2e0fbf8a9?auto=format&fit=crop&w=900&q=80", oldPrice: 6999, rating: 4.9, badge: "Kitchen deal" },
  { id: "flash-health", name: "Dettol Hygiene Kit", category: "health", image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80", oldPrice: 4499, rating: 4.7, badge: "Family pick" },
  { id: "flash-groceries", name: "Golden Basmati Rice 10kg", category: "groceries", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80", oldPrice: 4799, rating: 4.8, badge: "Pantry deal" }
];

const hotDeals: Deal[] = [
  { id: "hot-mobile", name: "Everyday Smartphone Bundle", category: "mobiles", image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80", oldPrice: 5499, rating: 4.7, badge: "Hot deal" },
  { id: "hot-accessory", name: "Magnetic Phone Case", category: "mobile accessories", image: "https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?auto=format&fit=crop&w=900&q=80", oldPrice: 4499, rating: 4.6, badge: "Trending" },
  { id: "hot-electronics", name: "Wireless Headphones", category: "electronics", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80", oldPrice: 5999, rating: 4.8, badge: "Top rated" },
  { id: "hot-fashion", name: "Nike Air Max Runner", category: "fashion", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", oldPrice: 6499, rating: 4.6, badge: "Limited offer" },
  { id: "hot-home", name: "Decorative Table Lamp", category: "home", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80", oldPrice: 4999, rating: 4.6, badge: "Home deal" },
  { id: "hot-beauty", name: "Daily Moisturizing Cream", category: "beauty", image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80", oldPrice: 4299, rating: 4.7, badge: "Beauty pick" },
  { id: "hot-appliances", name: "Cordless Stick Vacuum", category: "appliances", image: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=80", oldPrice: 6999, rating: 4.6, badge: "Quick clean" },
  { id: "hot-health", name: "Digital Blood Pressure Monitor", category: "health", image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=900&q=80", oldPrice: 5499, rating: 4.8, badge: "Wellness deal" },
  { id: "hot-groceries", name: "Premium Green Tea 100 Bags", category: "groceries", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80", oldPrice: 4299, rating: 4.7, badge: "Pantry pick" }
];

export default function HotDealsSlider({ categoryFilter, searchQuery, onAddToCart }: HotDealsSliderProps) {
  const [addedDeals, setAddedDeals] = useState<Set<string>>(() => new Set());
  const swiperRefs = useRef<Record<string, SwiperInstance | null>>({});
  const dealGroups = [
    { title: "Flash Deals", label: "Limited-time prices", deals: flashDeals },
    { title: "Hot Deals", label: "Popular right now", deals: hotDeals }
  ];

  return (
    <div className="deal-sections" id="deals">
      {dealGroups.map((group) => {
        const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const visibleDeals = group.deals.filter((deal) => {
          const matchesCategory = !categoryFilter || deal.category === categoryFilter;
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

                  return (
                    <SwiperSlide key={deal.id}>
                      <article className="deal-card">
                        <div className="deal-card-image">
                          <Image src={deal.image} alt={deal.name} fill sizes="(max-width: 560px) 82vw, (max-width: 1120px) 40vw, 25vw" unoptimized />
                          <span className="deal-badge">{deal.badge}</span>
                        </div>
                        <div className="deal-card-body">
                          <span className="deal-category">{deal.category}</span>
                          <h3>{deal.name}</h3>
                          <div className="deal-rating" aria-label={`Rated ${deal.rating} out of 5`}>
                            <span aria-hidden="true">★</span> {deal.rating.toFixed(1)}
                          </div>
                          <div className="deal-prices">
                            <strong>Rs 3,499</strong>
                            <del>Rs {deal.oldPrice.toLocaleString("en-PK")}</del>
                          </div>
                          <button
                            className="deal-add-button"
                            type="button"
                            disabled={isAdded}
                            onClick={() => {
                              setAddedDeals((current) => new Set(current).add(deal.id));
                              onAddToCart(deal);
                            }}
                          >
                            {isAdded ? "Added to cart" : "Add to cart"}
                          </button>
                        </div>
                      </article>
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
      <p className="cart-feedback" aria-live="polite">
        {addedDeals.size > 0 ? `${addedDeals.size} ${addedDeals.size === 1 ? "deal" : "deals"} added to your cart.` : ""}
      </p>
    </div>
  );
}
