import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });
dotenv.config();

const products = [
  {
    title: "Samsung Galaxy A35 5G",
    category: "Mobiles",
    price: 74999,
    originalPrice: 84999,
    images: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80"],
    description: "A vivid 5G smartphone with a bright display and all-day battery.",
    stock: 24,
    ratings: 4.8,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "HP Pavilion 14 Laptop",
    category: "Mobiles",
    price: 179999,
    images: ["https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80"],
    description: "A lightweight laptop for work, study, and everyday browsing.",
    stock: 9,
    ratings: 4.6,
    isFlashDeal: false,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Anker 20W USB-C Fast Charger",
    category: "Mobile Accessories",
    price: 3999,
    originalPrice: 4999,
    images: ["https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80"],
    description: "Compact fast charger for compatible USB-C phones and accessories.",
    stock: 70,
    ratings: 4.7,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Magnetic Phone Case",
    category: "Mobile Accessories",
    price: 1999,
    images: ["https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?auto=format&fit=crop&w=900&q=80"],
    description: "Protective magnetic case with a slim, comfortable grip.",
    stock: 55,
    ratings: 4.5,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "JBL Portable Bluetooth Speaker",
    category: "Electronics",
    price: 12999,
    originalPrice: 14999,
    images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80"],
    description: "Portable wireless speaker with rich sound for home or travel.",
    stock: 18,
    ratings: 4.8,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Wireless Over-Ear Headphones",
    category: "Electronics",
    price: 7999,
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80"],
    description: "Comfortable wireless headphones for music and calls.",
    stock: 31,
    ratings: 4.6,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "Khaadi Printed Lawn Set",
    category: "Fashion",
    price: 4499,
    originalPrice: 5499,
    images: ["https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"],
    description: "A colorful printed lawn outfit for warm-weather wear.",
    stock: 16,
    ratings: 4.6,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Classic Denim Jacket",
    category: "Fashion",
    price: 6499,
    images: ["https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80"],
    description: "A versatile denim layer with a classic everyday fit.",
    stock: 21,
    ratings: 4.4,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "Premium Cotton Bedsheet Set",
    category: "Home & Living",
    price: 3499,
    originalPrice: 4499,
    images: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80"],
    description: "Soft cotton bedding set designed for a comfortable night's sleep.",
    stock: 28,
    ratings: 4.7,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Decorative Table Lamp",
    category: "Home & Living",
    price: 4999,
    images: ["https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80"],
    description: "A warm accent lamp for bedside tables and living spaces.",
    stock: 13,
    ratings: 4.5,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "Hydrating Face Serum",
    category: "Beauty",
    price: 1999,
    originalPrice: 2499,
    images: ["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80"],
    description: "A lightweight hydrating serum for a fresh, dewy skincare routine.",
    stock: 42,
    ratings: 4.8,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Daily Moisturizing Cream",
    category: "Beauty",
    price: 1599,
    images: ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80"],
    description: "Daily moisturizer for soft, comfortable skin.",
    stock: 36,
    ratings: 4.6,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "Compact Air Fryer",
    category: "Appliances",
    price: 8999,
    originalPrice: 10999,
    images: ["https://images.unsplash.com/photo-1585518419759-7fe2e0fbf8a9?auto=format&fit=crop&w=900&q=80"],
    description: "Countertop air fryer for quick, convenient everyday cooking.",
    stock: 11,
    ratings: 4.7,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Cordless Stick Vacuum",
    category: "Appliances",
    price: 24999,
    images: ["https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=80"],
    description: "A lightweight cordless vacuum for quick home cleanups.",
    stock: 7,
    ratings: 4.6,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "Digital Blood Pressure Monitor",
    category: "Health",
    price: 4999,
    originalPrice: 5999,
    images: ["https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=900&q=80"],
    description: "Easy-to-read digital monitor for tracking blood pressure at home.",
    stock: 19,
    ratings: 4.8,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "First Aid Kit",
    category: "Health",
    price: 1599,
    images: ["https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=900&q=80"],
    description: "A practical collection of first-aid essentials for home and travel.",
    stock: 48,
    ratings: 4.5,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  },
  {
    title: "Golden Basmati Rice 10kg",
    category: "Groceries",
    price: 2799,
    originalPrice: 3199,
    images: ["https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80"],
    description: "Aromatic long-grain basmati rice for everyday meals and special occasions.",
    stock: 60,
    ratings: 4.8,
    isFlashDeal: true,
    isFeatured: true,
    isMarkazProduct: false
  },
  {
    title: "Premium Green Tea 100 Bags",
    category: "Groceries",
    price: 899,
    images: ["https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80"],
    description: "A box of refreshing green tea bags for your daily cup.",
    stock: 85,
    ratings: 4.7,
    isFlashDeal: false,
    isFeatured: false,
    isMarkazProduct: false
  }
].map((product) => ({
  ...product,
  slug: product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}));

async function seed() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured. Set it in your environment or .env file.");
  }

  await mongoose.connect(uri, { bufferCommands: false });
  const collection = mongoose.connection.collection("products");
  const now = new Date();
  const result = await collection.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { slug: product.slug },
        update: {
          $set: { ...product, updatedAt: now },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    })),
    { ordered: true }
  );

  console.info(
    `Seeded ${products.length} products across 9 categories ` +
    `(${products.filter(({ isFlashDeal }) => isFlashDeal).length} flash deals; ` +
    `${result.upsertedCount} inserted, ${result.modifiedCount} updated).`
  );
}

seed()
  .catch((error) => {
    console.error("Product seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
