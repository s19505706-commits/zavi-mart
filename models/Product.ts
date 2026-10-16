import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const productVariantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  required: { type: Boolean, default: true },
  options: { type: [String], required: true, validate: (options: string[]) => options.length > 0 }
}, { _id: false });

const productVariantCombinationSchema = new mongoose.Schema({
  id: { type: String, trim: true, maxlength: 200 },
  sku: { type: String, trim: true, maxlength: 200 },
  stock: { type: Number, min: 0 },
  image: { type: String, trim: true, maxlength: 2048 },
  in_stock: { type: Boolean },
  inStock: { type: Boolean },
  attributes: { type: Map, of: String, required: true }
}, { _id: false, strict: false });

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, min: 0 },
  originalPrice: { type: Number, min: 0 },
  images: { type: [String], default: [] },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  departmentId: { type: String, default: null, index: true },
  categoryId: { type: String, default: null, index: true },
  stock: { type: Number, min: 0, default: 0 },
  hasVariants: { type: Boolean, default: false },
  variantOptions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  variants: { type: [productVariantSchema], default: [] },
  variantCombinations: { type: [productVariantCombinationSchema], default: [] },
  description: { type: String, default: "", maxlength: 5000 },
  originalMarkazTitle: { type: String, trim: true, default: null, maxlength: 200 },
  productCode: { type: String, trim: true, default: null },
  markazCode: { type: String, trim: true, default: null },
  supplierCode: { type: String, trim: true, default: null },
  originalDescription: { type: String, default: null, maxlength: 5000 },
  isFlashDeal: { type: Boolean, default: false },
  isHotDeal: { type: Boolean, default: false },
  flashDealDiscount: { type: Number, min: 0, max: 100, default: 0 },
  flashDealExpiry: { type: Date, default: null },
  hotDealLabel: { type: String, trim: true, default: "" },
  isFeatured: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  dealEndDate: { type: Date, default: null },
  discountPercent: { type: Number, min: 0, max: 100, default: 0 },
  brand: { type: String, trim: true, default: "" },
  sku: { type: String, trim: true, default: "" },
  isMarkazProduct: { type: Boolean, default: false },
  isDropship: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  importSource: { type: String, default: "manual", trim: true },
  markazProductId: { type: String, trim: true, maxlength: 1000 },
  markazProductUrl: { type: String, trim: true, maxlength: 2000 },
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

const existingProductModel = mongoose.models.Product;
if (
  existingProductModel &&
  ["productCode", "markazCode", "supplierCode", "originalDescription", "originalMarkazTitle", "departmentId", "categoryId", "markazProductUrl", "isDropship", "costPrice", "variantOptions", "variants", "variantCombinations"]
    .some((field) => !existingProductModel.schema.path(field))
) {
  mongoose.deleteModel("Product");
}

const Product = mongoose.models.Product
  ? mongoose.model<ProductRecord>("Product")
  : mongoose.model<ProductRecord>("Product", productSchema);

export default Product;
