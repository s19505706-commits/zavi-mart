import mongoose, { type InferSchemaType } from "mongoose";

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  products: {
    type: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      title: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      costPrice: { type: Number, min: 0 },
      qty: { type: Number, required: true, min: 1 },
      image: { type: String, default: "" },
      selectedVariants: { type: Map, of: String, default: {} },
      variantId: { type: String, default: "" },
      variantString: { type: String, default: "" },
      isMarkazProduct: { type: Boolean, default: false },
      markazProductId: { type: String, default: "" },
      markazProductUrl: { type: String, default: "" },
      wholesalePrice: { type: Number, min: 0 },
      profit: { type: Number, min: 0, default: 0 },
      supplier: {
        name: { type: String, default: "" },
        productUrl: { type: String, default: "" },
        info: { type: String, default: "" }
      }
    }],
    required: true,
    validate: {
      validator: (products: unknown[]) => products.length > 0,
      message: "An order must contain at least one product."
    }
  },
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  profit: { type: Number, min: 0, default: 0 },
  customerName: { type: String, trim: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  alternatePhone: { type: String, trim: true, default: "" },
  city: { type: String, trim: true, default: "" },
  areaSector: { type: String, trim: true, default: "" },
  streetAddress: { type: String, trim: true, default: "" },
  fullAddress: { type: String, trim: true, default: "" },
  deliveredAt: { type: Date, default: null },
  supplierOrderedOnMarkaz: { type: Boolean, default: false },
  supplierOrderedAt: { type: Date, default: null },
  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true, default: "" },
    areaSector: { type: String, trim: true, default: "" },
    streetAddress: { type: String, trim: true, default: "" },
    fullAddress: { type: String, trim: true, default: "" }
  },
  paymentMethod: { type: String, enum: ["COD"], default: "COD", required: true },
  status: {
    type: String,
    enum: ["pending", "processing", "confirmed", "shipped", "delivered"],
    default: "pending",
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export type OrderRecord = InferSchemaType<typeof orderSchema>;

const existingOrderModel = mongoose.models.Order;
const existingOrderStatusPath = existingOrderModel?.schema.path("status");
const existingOrderStatusEnum = existingOrderStatusPath?.options.enum;
const existingOrderHasProcessingStatus = Array.isArray(existingOrderStatusEnum) &&
  existingOrderStatusEnum.includes("processing");
if (existingOrderModel && (
  !existingOrderModel.schema.path("products.markazProductUrl") ||
  !existingOrderModel.schema.path("products.costPrice") ||
  !existingOrderModel.schema.path("products.selectedVariants") ||
  !existingOrderModel.schema.path("products.variantId") ||
  !existingOrderModel.schema.path("products.variantString") ||
  !existingOrderModel.schema.path("alternatePhone") ||
  !existingOrderModel.schema.path("supplierOrderedOnMarkaz") ||
  !existingOrderModel.schema.path("deliveredAt") ||
  !existingOrderHasProcessingStatus
)) {
  mongoose.deleteModel("Order");
}

const Order = mongoose.models.Order
  ? mongoose.model<OrderRecord>("Order")
  : mongoose.model<OrderRecord>("Order", orderSchema);

export default Order;
