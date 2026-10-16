import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const hotDealSchema = new mongoose.Schema({
  dealType: { type: String, enum: ["single", "bundle"], default: "single", index: true },
  productId: { type: String, default: "", index: true },
  productIds: { type: [String], default: [] },
  products: {
    type: [{
      productId: { type: String, required: true },
      title: { type: String, required: true, trim: true, maxlength: 200 },
      image: { type: String, default: "" },
      category: { type: String, default: "General", trim: true, maxlength: 100 },
      originalPrice: { type: Number, required: true, min: 0 }
    }],
    default: []
  },
  productName: { type: String, default: "", trim: true, maxlength: 820 },
  productImage: { type: String, default: "" },
  category: { type: String, default: "General", trim: true, maxlength: 100 },
  bundleTitle: { type: String, default: "", trim: true, maxlength: 120 },
  bundleImage: { type: String, default: "", maxlength: 1000000 },
  originalPrice: { type: Number, required: true, min: 0 },
  originalTotalPrice: { type: Number, min: 0 },
  dealPrice: { type: Number, required: true, min: 0 },
  discountType: { type: String, enum: ["percent", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  badgeText: { type: String, required: true, trim: true, maxlength: 80 },
  customTitle: { type: String, default: "", trim: true, maxlength: 120 },
  priority: { type: Number, required: true, min: 1, default: 1 },
  showOnHomepage: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  validTill: { type: Date, default: null }
}, { timestamps: true, collection: "hot_deals" });

hotDealSchema.index({ isActive: 1, showOnHomepage: 1, priority: 1 });

export type HotDealRecord = InferSchemaType<typeof hotDealSchema>;
export type HotDealDocument = HydratedDocument<HotDealRecord>;

const HotDeal = mongoose.models.HotDeal
  ? mongoose.model<HotDealRecord>("HotDeal")
  : mongoose.model<HotDealRecord>("HotDeal", hotDealSchema);

export default HotDeal;
