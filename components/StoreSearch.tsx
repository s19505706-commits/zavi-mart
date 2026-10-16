"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { SearchSuggestionProduct } from "./SearchSuggestionList";

const SearchSuggestionList = dynamic(() => import("./SearchSuggestionList"), {
  ssr: false,
  loading: () => <div className="search-suggestions"><p className="search-suggestions-status">Searching products…</p></div>
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProducts(value: unknown): SearchSuggestionProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SearchSuggestionProduct[] =>
    isRecord(item) && typeof item._id === "string" && typeof item.title === "string" &&
      typeof item.price === "number" && typeof item.category === "string"
      ? [{
        _id: item._id,
        title: item.title,
        price: item.price,
        category: item.category,
        image: typeof item.image === "string" ? item.image : ""
      }]
      : []
  );
}

export default function StoreSearch({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const router = useRouter();
  const container = useRef<HTMLFormElement>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestionProduct[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value.trim();
  const showSuggestions = focused && query.length > 0;

  useEffect(() => {
    if (!showSuggestions) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timeout = window.setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(query)}&limit=5`, {
        cache: "no-store",
        signal: controller.signal
      }).then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.products)) {
          throw new Error("Product suggestions could not be loaded.");
        }
        setSuggestions(parseProducts(result.products).slice(0, 5));
      }).catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        console.error("Could not load live product suggestions.", loadError);
        setSuggestions([]);
        setError("Suggestions are temporarily unavailable.");
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, showSuggestions]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = suggestions[activeIndex];
    if (selected) {
      router.push(`/product/${encodeURIComponent(selected._id)}`);
    } else if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
    setFocused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <form
      className="header-search-wrap"
      ref={container}
      role="search"
      onSubmit={submitSearch}
      onBlur={(event) => {
        if (!container.current?.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <label className="header-search">
        <Search size={19} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search for products..."
          aria-label="Search for products"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="store-search-suggestions"
          value={value}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(-1);
          }}
        />
      </label>
      {showSuggestions && (
        <SearchSuggestionList
          loading={loading}
          error={error}
          suggestions={suggestions}
          activeIndex={activeIndex}
          query={query}
          onSelect={() => setFocused(false)}
        />
      )}
    </form>
  );
}
