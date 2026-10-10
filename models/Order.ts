import mongoose, { type InferSchemaType } from "mongoose";

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  products: {
    type: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      title: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      qty: { type: Number, required: true, min: 1 },
      image: { type: String, default: "" },
      isMarkazProduct: { type: Boolean, default: false },
      markazProductId: { type: String, default: "" },
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
  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true }
  },
  paymentMethod: { type: String, enum: ["COD"], default: "COD", required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "delivered"],
    default: "pending",
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export type OrderRecord = InferSchemaType<typeof orderSchema>;

const Order = mongoose.models.Order
  ? mongoose.model<OrderRecord>("Order")
  : mongoose.model<OrderRecord>("Order", orderSchema);

export default Order;
