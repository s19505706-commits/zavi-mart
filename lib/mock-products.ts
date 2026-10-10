import { getCategoryId, type ProductCategory } from "./product-categories";

const updatedAt = new Date("2026-10-08T00:00:00.000Z");

const productData: Array<{
  title: string;
  category: ProductCategory;
  price: number;
  originalPrice?: number;
  image: string;
  description: string;
  stock: number;
  rating: number;
  isFlashDeal: boolean;
}> = [
  { title: "Samsung Galaxy A35 5G", category: "Mobiles", price: 74999, originalPrice: 84999, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80", description: "A vivid 5G smartphone with a bright display and all-day battery.", stock: 24, rating: 4.8, isFlashDeal: true },
  { title: "HP Pavilion 14 Laptop", category: "Mobiles", price: 179999, image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80", description: "A lightweight laptop for work, study, and everyday browsing.", stock: 9, rating: 4.6, isFlashDeal: false },
  { title: "Anker 20W USB-C Fast Charger", category: "Mobile Accessories", price: 3999, originalPrice: 4999, image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80", description: "Compact fast charger for compatible USB-C phones and accessories.", stock: 70, rating: 4.7, isFlashDeal: true },
  { title: "Magnetic Phone Case", category: "Mobile Accessories", price: 1999, image: "https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?auto=format&fit=crop&w=900&q=80", description: "Protective magnetic case with a slim, comfortable grip.", stock: 55, rating: 4.5, isFlashDeal: false },
  { title: "JBL Portable Bluetooth Speaker", category: "Electronics", price: 12999, originalPrice: 14999, image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80", description: "Portable wireless speaker with rich sound for home or travel.", stock: 18, rating: 4.8, isFlashDeal: true },
  { title: "Wireless Over-Ear Headphones", category: "Electronics", price: 7999, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80", description: "Comfortable wireless headphones for music and calls.", stock: 31, rating: 4.6, isFlashDeal: false },
  { title: "Khaadi Printed Lawn Set", category: "Fashion", price: 4499, originalPrice: 5499, image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80", description: "A colorful printed lawn outfit for warm-weather wear.", stock: 16, rating: 4.6, isFlashDeal: true },
  { title: "Classic Denim Jacket", category: "Fashion", price: 6499, image: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80", description: "A versatile denim layer with a classic everyday fit.", stock: 21, rating: 4.4, isFlashDeal: false },
  { title: "Premium Cotton Bedsheet Set", category: "Home & Living", price: 3499, originalPrice: 4499, image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80", description: "Soft cotton bedding set designed for a comfortable night's sleep.", stock: 28, rating: 4.7, isFlashDeal: true },
  { title: "Decorative Table Lamp", category: "Home & Living", price: 4999, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80", description: "A warm accent lamp for bedside tables and living spaces.", stock: 13, rating: 4.5, isFlashDeal: false },
  { title: "Hydrating Face Serum", category: "Beauty", price: 1999, originalPrice: 2499, image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80", description: "A lightweight hydrating serum for a fresh, dewy skincare routine.", stock: 42, rating: 4.8, isFlashDeal: true },
  { title: "Daily Moisturizing Cream", category: "Beauty", price: 1599, image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80", description: "Daily moisturizer for soft, comfortable skin.", stock: 36, rating: 4.6, isFlashDeal: false },
  { title: "Compact Air Fryer", category: "Appliances", price: 8999, originalPrice: 10999, image: "https://images.unsplash.com/photo-1585518419759-7fe2e0fbf8a9?auto=format&fit=crop&w=900&q=80", description: "Countertop air fryer for quick, convenient everyday cooking.", stock: 11, rating: 4.7, isFlashDeal: true },
  { title: "Cordless Stick Vacuum", category: "Appliances", price: 24999, image: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=80", description: "A lightweight cordless vacuum for quick home cleanups.", stock: 7, rating: 4.6, isFlashDeal: false },
  { title: "Digital Blood Pressure Monitor", category: "Health", price: 4999, originalPrice: 5999, image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=900&q=80", description: "Easy-to-read digital monitor for tracking blood pressure at home.", stock: 19, rating: 4.8, isFlashDeal: true },
  { title: "First Aid Kit", category: "Health", price: 1599, image: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=900&q=80", description: "A practical collection of first-aid essentials for home and travel.", stock: 48, rating: 4.5, isFlashDeal: false },
  { title: "Golden Basmati Rice 10kg", category: "Groceries", price: 2799, originalPrice: 3199, image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80", description: "Aromatic long-grain basmati rice for everyday meals and special occasions.", stock: 60, rating: 4.8, isFlashDeal: true },
  { title: "Premium Green Tea 100 Bags", category: "Groceries", price: 899, image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80", description: "A box of refreshing green tea bags for your daily cup.", stock: 85, rating: 4.7, isFlashDeal: false }
];

export type MockProduct = {
  _id: string;
  id: string;
  title: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  oldPrice: number;
  images: string[];
  image: string;
  category: ProductCategory;
  categoryId: string;
  stock: number;
  description: string;
  isFlashDeal: boolean;
  isFeatured: boolean;
  isMarkazProduct: boolean;
  isActive?: boolean;
  markazProductId: string | null;
  wholesalePrice: number | null;
  sellingPrice: number | null;
  profit: number | null;
  supplier: { name: string; productUrl: string; info: string } | null;
  ratings: number;
  rating: number;
  reviews?: number;
  badge: string;
  createdAt: Date;
  updatedAt: Date;
};

export const MOCK_PRODUCTS: MockProduct[] = productData.map((product, index) => {
  const id = (index + 1).toString(16).padStart(24, "0");
  const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { image, rating, ...details } = product;

  return {
    _id: id,
    id,
    ...details,
    name: product.title,
    slug,
    originalPrice: product.originalPrice ?? null,
    oldPrice: product.originalPrice ?? product.price,
    images: [image],
    image,
    categoryId: getCategoryId(product.category),
    isFeatured: product.isFlashDeal,
    isMarkazProduct: false,
    markazProductId: null,
    wholesalePrice: null,
    sellingPrice: null,
    profit: null,
    supplier: null,
    ratings: rating,
    rating,
    badge: product.isFlashDeal ? "Flash deal" : "",
    createdAt: updatedAt,
    updatedAt
  };
});

export function addMockProduct(product: MockProduct): void {
  if (!MOCK_PRODUCTS.some((entry) => entry.id === product.id)) {
    MOCK_PRODUCTS.unshift(product);
  }
}

export function filterMockProducts({
  category,
  search,
  flashDeals
}: {
  category?: string;
  search?: string;
  flashDeals?: boolean;
}) {
  const normalizedSearch = search?.toLocaleLowerCase();
  return MOCK_PRODUCTS.filter((product) =>
    (!category || product.category === category) &&
    (!normalizedSearch || product.title.toLocaleLowerCase().includes(normalizedSearch)) &&
    (flashDeals !== true || product.isFlashDeal)
  );
}
