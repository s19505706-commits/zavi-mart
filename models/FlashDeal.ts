import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const flashDealSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true, trim: true },
  productImage: { type: String, default: "" },
  flashPrice: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, required: true, min: 0, max: 100 },
  stockLimit: { type: Number, required: true, min: 1 },
  soldCount: { type: Number, default: 0, min: 0 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  badgeText: { type: String, default: "Flash Sale", trim: true, maxlength: 80 }
}, { timestamps: true, collection: "flash_deals" });

flashDealSchema.index({ isActive: 1, startTime: 1, endTime: 1 });

export type FlashDealRecord = InferSchemaType<typeof flashDealSchema>;
export type FlashDealDocument = HydratedDocument<FlashDealRecord>;

const FlashDeal = mongoose.models.FlashDeal
  ? mongoose.model<FlashDealRecord>("FlashDeal")
  : mongoose.model<FlashDealRecord>("FlashDeal", flashDealSchema);

export default FlashDeal;
