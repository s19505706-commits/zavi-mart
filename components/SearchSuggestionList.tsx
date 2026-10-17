"use client";

import Image from "next/image";
import Link from "next/link";

export type SearchSuggestionProduct = {
  _id: string;
  title: string;
  price: number;
  image: string;
  category: string;
};

export default function SearchSuggestionList({
  loading,
  error,
  suggestions,
  activeIndex,
  query,
  onSelect
}: {
  loading: boolean;
  error: string;
  suggestions: SearchSuggestionProduct[];
  activeIndex: number;
  query: string;
  onSelect: () => void;
}) {
  return (
    <div className="search-suggestions" id="store-search-suggestions" role="listbox" aria-label="Product suggestions">
      {loading && <p className="search-suggestions-status" role="status">Searching products…</p>}
      {!loading && error && <p className="search-suggestions-status" role="status">{error}</p>}
      {!loading && !error && suggestions.map((product, index) => (
        <Link
          className={`search-suggestion ${activeIndex === index ? "is-active" : ""}`}
          href={`/product/${encodeURIComponent(product._id)}`}
          role="option"
          aria-selected={activeIndex === index}
          key={product._id}
          onClick={onSelect}
        >
          {product.image
            ? <span className="search-suggestion-image"><Image src={product.image} alt="" width={48} height={48} unoptimized loading="lazy" /></span>
            : <span className="search-suggestion-placeholder" aria-hidden="true" />}
          <span className="search-suggestion-copy">
            <strong>{product.title}</strong>
            <small>{product.category}</small>
          </span>
          <strong className="search-suggestion-price">Rs {product.price.toLocaleString("en-PK")}</strong>
        </Link>
      ))}
      {!loading && !error && suggestions.length === 0 && (
        <p className="search-suggestions-status" role="status">No matching products found.</p>
      )}
      {!loading && suggestions.length > 0 && (
        <button className="search-all-results" type="submit">
          View all results for “{query}”
        </button>
      )}
    </div>
  );
}
