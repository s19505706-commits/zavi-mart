import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";
import { PRODUCT_CATEGORIES } from "../lib/product-categories";

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, min: 0 },
  images: { type: [String], default: [] },
  category: { type: String, required: true, enum: PRODUCT_CATEGORIES },
  stock: { type: Number, min: 0, default: 0 },
  description: { type: String, default: "", maxlength: 5000 },
  isFlashDeal: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  isMarkazProduct: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  markazProductId: { type: String, trim: true, maxlength: 1000 },
  wholesalePrice: { type: Number, min: 0 },
  sellingPrice: { type: Number, min: 0 },
  profit: { type: Number, min: 0 },
  supplier: {
    name: { type: String, trim: true },
    productUrl: { type: String, trim: true },
    info: { type: String, trim: true }
  },
  ratings: { type: Number, min: 0, max: 5, default: 0 },
  reviews: { type: Number, min: 0, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ isFlashDeal: 1, createdAt: -1 });

export type ProductRecord = InferSchemaType<typeof productSchema>;
export type ProductDocument = HydratedDocument<ProductRecord>;

const Product = mongoose.models.Product
  ? mongoose.model<ProductRecord>("Product")
  : mongoose.model<ProductRecord>("Product", productSchema);

export default Product;
