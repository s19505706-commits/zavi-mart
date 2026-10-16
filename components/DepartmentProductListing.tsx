"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";
import { CART_STORAGE_KEY, type CartItem } from "../lib/cart";

type Department = { id: string; name: string; slug: string; image?: string };
type Category = { id: string; name: string; slug: string; departmentId: string };
type StoreProduct = {
  _id: string;
  title: string;
  category: string;
  departmentId?: string | null;
  categoryId?: string | null;
  image: string;
  price: number;
  originalPrice?: number | null;
  isNewArrival: boolean;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCartItem(value: unknown): value is CartItem {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.image === "string" &&
    typeof value.price === "number" && Number.isFinite(value.price) &&
    typeof value.quantity === "number" && Number.isInteger(value.quantity) && value.quantity > 0 &&
    (value.checkoutProductId === undefined ||
      (typeof value.checkoutProductId === "number" && Number.isInteger(value.checkoutProductId)));
}

function parseStoreProducts(value: unknown): StoreProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StoreProduct[] =>
    isRecord(item) && typeof item._id === "string" && typeof item.title === "string" &&
      typeof item.category === "string" && typeof item.price === "number"
      ? [{
        _id: item._id,
        title: item.title,
        category: item.category,
        departmentId: typeof item.departmentId === "string" ? item.departmentId : null,
        categoryId: typeof item.categoryId === "string" ? item.categoryId : null,
        image: typeof item.image === "string" ? item.image : "",
        price: item.price,
        originalPrice: typeof item.originalPrice === "number" ? item.originalPrice : null,
        isNewArrival: item.isNewArrival === true,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : ""
      }]
      : []
  );
}

export default function DepartmentProductListing({
  departmentSlug,
  categorySlug
}: {
  departmentSlug: string;
  categorySlug?: string;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [newArrivalProducts, setNewArrivalProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedProductIds, setAddedProductIds] = useState<string[]>([]);
  const [cartError, setCartError] = useState("");

  function addToCart(product: StoreProduct) {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      const parsedCart: unknown = savedCart ? JSON.parse(savedCart) : [];
      if (!Array.isArray(parsedCart) || !parsedCart.every(isCartItem)) {
        throw new Error("The saved cart has an invalid format.");
      }

      const cart = parsedCart;
      const existingItem = cart.find((item) => item.id === product._id);
      const updatedCart = existingItem
        ? cart.map((item) => item.id === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item)
        : [...cart, {
            id: product._id,
            name: product.title,
            image: product.image,
            price: product.price,
            quantity: 1
          }];
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updatedCart));
      setAddedProductIds((current) => current.includes(product._id)
        ? current
        : [...current, product._id]);
      setCartError("");
    } catch (cartSaveError) {
      console.error("Could not add this product to the cart:", cartSaveError);
      setCartError("This product could not be added to your cart. Please try again.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/departments", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" })
    ]).then(async ([departmentResponse, categoryResponse]) => {
      const [departmentResult, categoryResult]: unknown[] = await Promise.all([
        departmentResponse.json(),
        categoryResponse.json()
      ]);
      if (!departmentResponse.ok || !categoryResponse.ok ||
          !isRecord(departmentResult) || !Array.isArray(departmentResult.departments) ||
          !isRecord(categoryResult) || !Array.isArray(categoryResult.categories)) {
        throw new Error("Could not load this department's products.");
      }
      const loadedDepartments = departmentResult.departments.flatMap((item): Department[] =>
        isRecord(item) && typeof item.id === "string" && typeof item.name === "string" &&
          typeof item.slug === "string"
          ? [{ id: item.id, name: item.name, slug: item.slug, image: typeof item.image === "string" ? item.image : undefined }]
          : []
      );
      const loadedCategories = categoryResult.categories.flatMap((item): Category[] =>
        isRecord(item) && typeof item.id === "string" && typeof item.name === "string" &&
          typeof item.slug === "string" && typeof item.departmentId === "string"
          ? [{ id: item.id, name: item.name, slug: item.slug, departmentId: item.departmentId }]
          : []
      );
      const targetDepartment = loadedDepartments.find((item) => item.slug === departmentSlug);
      const targetCategory = categorySlug
        ? loadedCategories.find((item) => item.departmentId === targetDepartment?.id && item.slug === categorySlug)
        : undefined;
      const productParams = new URLSearchParams({ limit: "100" });
      const arrivalParams = new URLSearchParams({ limit: "100", newArrivals: "true" });
      if (targetDepartment) {
        arrivalParams.set("departmentId", targetDepartment.id);
      }
      if (targetCategory) {
        arrivalParams.set("categoryId", targetCategory.id);
      }
      const [productResponse, arrivalResponse] = await Promise.all([
        fetch(`/api/products?${productParams}`, { cache: "no-store" }),
        fetch(`/api/products?${arrivalParams}`, { cache: "no-store" })
      ]);
      const [productResult, arrivalResult]: unknown[] = await Promise.all([
        productResponse.json(),
        arrivalResponse.json()
      ]);
      if (!productResponse.ok || !arrivalResponse.ok ||
          !isRecord(productResult) || !Array.isArray(productResult.products) ||
          !isRecord(arrivalResult) || !Array.isArray(arrivalResult.products)) {
        throw new Error("Could not load this department's products.");
      }
      const loadedProducts = parseStoreProducts(productResult.products);
      const loadedArrivals = parseStoreProducts(arrivalResult.products);
      if (!cancelled) {
        setDepartments(loadedDepartments);
        setCategories(loadedCategories);
        setProducts(loadedProducts);
        setNewArrivalProducts(loadedArrivals);
      }
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load products.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const department = departments.find((item) => item.slug === departmentSlug);
  const departmentCategories = categories.filter((item) => item.departmentId === department?.id);
  const category = categorySlug ? departmentCategories.find((item) => item.slug === categorySlug) : undefined;
  const visibleProducts = products.filter((product) => {
    const matchesDepartment = product.departmentId === department?.id ||
      (!product.departmentId && product.category.toLocaleLowerCase() === department?.name.toLocaleLowerCase());
    return matchesDepartment && (!categorySlug ||
      product.categoryId === category?.id ||
      product.category.toLocaleLowerCase() === category?.name.toLocaleLowerCase());
  });
  const newArrivals = newArrivalProducts.filter((product) => {
    const matchesDepartment = product.departmentId === department?.id;
    return matchesDepartment && (!categorySlug || product.categoryId === category?.id);
  })
    .filter((product) => product.isNewArrival)
    .sort((left, right) => Date.parse(right.createdAt || "0") - Date.parse(left.createdAt || "0"))
    .slice(0, 8);

  return (
    <main className="department-listing">
      <nav aria-label="Breadcrumb" className="department-breadcrumb">
        <Link href="/">Home</Link>
        {department && <><span aria-hidden="true">›</span><Link href={`/department/${encodeURIComponent(department.slug)}`}>{department.name}</Link></>}
        {category && <><span aria-hidden="true">›</span><span aria-current="page">{category.name}</span></>}
      </nav>
      <header className="department-listing-heading">
        <span className="section-eyebrow">ZaviMart collection</span>
        <h1>{category?.name ?? department?.name ?? "Department"}</h1>
        {department && <p>{category ? `Products in ${category.name}` : `Shop ${department.name} and browse by category.`}</p>}
      </header>
      {department && !categorySlug && departmentCategories.length > 0 && (
        <nav className="department-category-links" aria-label={`${department.name} categories`}>
          {departmentCategories.map((item) => (
            <Link key={item.id} href={`/department/${encodeURIComponent(department.slug)}/${encodeURIComponent(item.slug)}`}>
              {item.name}
            </Link>
          ))}
        </nav>
      )}
      {error ? <p role="alert">{error}</p> : loading ? <p>Loading products…</p> :
        !department || (categorySlug && !category) ? <p>This department or category could not be found.</p> :
          <>
            {cartError && <p role="alert">{cartError}</p>}
            {newArrivals.length > 0 && (
              <section aria-labelledby="new-arrivals-heading">
                <header className="department-listing-heading">
                  <span className="section-eyebrow">Just arrived</span>
                  <h2 id="new-arrivals-heading">
                    New in {category?.name ?? department.name}
                  </h2>
                </header>
                <div className="department-product-grid">
                  {newArrivals.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={{
                        id: product._id,
                        title: product.title,
                        category: `${department.name} · ${product.category}`,
                        image: product.image,
                        price: product.price,
                        badge: "New"
                      }}
                      isAdded={addedProductIds.includes(product._id)}
                      onAddToCart={() => addToCart(product)}
                    />
                  ))}
                </div>
              </section>
            )}
            <section aria-labelledby="all-products-heading">
              <header className="department-listing-heading">
                <h2 id="all-products-heading">All Products</h2>
              </header>
              {visibleProducts.length ? (
            <div className="department-product-grid">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={{
                    id: product._id,
                    title: product.title,
                    category: `${department.name} · ${product.category}`,
                    image: product.image,
                    price: product.price
                  }}
                  isAdded={addedProductIds.includes(product._id)}
                  onAddToCart={() => addToCart(product)}
                />
              ))}
            </div>
              ) : <p>No products are available in this collection yet.</p>}
            </section>
          </>}
    </main>
  );
}
