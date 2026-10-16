export type CartItem = {
  id: string;
  productId?: string;
  checkoutProductId?: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  selectedVariants?: Record<string, string>;
  variantId?: string;
};

export const CART_STORAGE_KEY = "zavimart-next-cart";

export const CHECKOUT_PRODUCTS_BY_CART_ID: Record<string, { id: number; name: string; price: number }> = {
  "starter-mobile": { id: 1, name: "Samsung Galaxy A35 5G", price: 74999 },
  "starter-accessory": { id: 15, name: "Anker 20W USB-C Fast Charger", price: 4999 },
  "flash-mobile": { id: 1, name: "Samsung Galaxy A35 5G", price: 74999 },
  "flash-accessory": { id: 15, name: "Anker 20W USB-C Fast Charger", price: 4999 },
  "flash-electronics": { id: 17, name: "JBL Portable Bluetooth Speaker", price: 14999 },
  "flash-fashion": { id: 2, name: "Khaadi Lawn Printed Set", price: 4999 },
  "flash-home": { id: 6, name: "Premium Cotton Bedsheet Set", price: 3999 },
  "flash-beauty": { id: 4, name: "Hydrating Face Serum", price: 2499 },
  "flash-appliances": { id: 3, name: "Braun Air Fryer 4.2L", price: 28999 },
  "flash-health": { id: 7, name: "Dettol Hygiene Kit", price: 1599 },
  "flash-groceries": { id: 12, name: "Golden Basmati Rice 10kg", price: 2999 },
  "hot-mobile": { id: 1, name: "Samsung Galaxy A35 5G", price: 74999 },
  "hot-accessory": { id: 16, name: "Magnetic Phone Case", price: 1999 },
  "hot-electronics": { id: 5, name: "AirPods Pro 2", price: 57999 },
  "hot-fashion": { id: 11, name: "Nike Air Max Runner", price: 8999 },
  "hot-home": { id: 22, name: "Decorative Table Lamp", price: 4999 },
  "hot-beauty": { id: 23, name: "Daily Moisturizing Cream", price: 1899 },
  "hot-appliances": { id: 28, name: "Cordless Stick Vacuum", price: 24999 },
  "hot-health": { id: 29, name: "Digital Blood Pressure Monitor", price: 5999 },
  "hot-groceries": { id: 25, name: "Premium Green Tea 100 Bags", price: 899 }
};

export const STARTER_CART_ITEMS: CartItem[] = [
  {
    id: "starter-mobile",
    checkoutProductId: 1,
    name: "Samsung Galaxy A35 5G",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=320&q=80",
    price: 74999,
    quantity: 1
  },
  {
    id: "starter-accessory",
    checkoutProductId: 15,
    name: "Anker 20W USB-C Fast Charger",
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=320&q=80",
    price: 4999,
    quantity: 1
  }
];
