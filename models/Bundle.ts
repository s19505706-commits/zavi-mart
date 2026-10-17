import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const bundleItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  image: { type: String, default: "", maxlength: 2048 },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

const bundleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  tag: { type: String, enum: ["VALUE SET", "LIMITED EDITION", "CURATED SET"], default: "VALUE SET" },
  images: { type: [{ type: String, maxlength: 2048 }], default: [], validate: (images: string[]) => images.length <= 3 },
  items: { type: [bundleItemSchema], default: [], validate: (items: unknown[]) => items.length <= 30 },
  setPrice: { type: Number, required: true, min: 0 },
  valuePrice: { type: Number, required: true, min: 0 },
  savings: { type: Number, min: 0, default: 0 },
  timerHours: { type: Number, min: 1, max: 72, default: 4 },
  timerExpiry: { type: Date, default: () => new Date(Date.now() + 4 * 60 * 60 * 1000) },
  stockTotal: { type: Number, min: 0, default: 50 },
  stockClaimed: { type: Number, min: 0, default: 0 },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, collection: "bundles" });

bundleSchema.pre("save", function () {
  this.savings = this.valuePrice - this.setPrice;
  if (this.isNew || this.isModified("timerHours")) {
    this.timerExpiry = new Date(Date.now() + this.timerHours * 60 * 60 * 1000);
  }
});

bundleSchema.index({ isActive: 1, createdAt: -1 });

export type BundleRecord = InferSchemaType<typeof bundleSchema>;
export type BundleDocument = HydratedDocument<BundleRecord>;

const Bundle = mongoose.models.Bundle
  ? mongoose.model<BundleRecord>("Bundle")
  : mongoose.model<BundleRecord>("Bundle", bundleSchema);

export default Bundle;
