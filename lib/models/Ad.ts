import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";
import {
  AD_ANIMATION_SPEEDS,
  AD_ANIMATION_STYLES,
  AD_AUDIO_TYPES,
  AD_FILTER_PRESETS,
  AD_IMAGE_POSITIONS,
  AD_TEXT_EFFECTS
} from "../ad-types";

const adSchema = new mongoose.Schema({
  campaignName: { type: String, required: true, trim: true, maxlength: 100, default: "New campaign" },
  titleLines: {
    type: [{ type: String, trim: true, maxlength: 60 }],
    default: ["WHAT", "EVER", "YOU", "SELL"],
    validate: (lines: string[]) => lines.length > 0 && lines.length <= 8
  },
  secondLines: {
    type: [{ type: String, trim: true, maxlength: 60 }],
    default: ["SELL", "MORE", "MORE", "MORE", "MORE"],
    validate: (lines: string[]) => lines.length > 0 && lines.length <= 8
  },
  finalLines: {
    type: [{ type: String, trim: true, maxlength: 60 }],
    default: ["THE", "WORLD'S", "BEST", "CHECKOUT"],
    validate: (lines: string[]) => lines.length > 0 && lines.length <= 8
  },
  products: {
    type: [{ type: String, trim: true, maxlength: 100 }],
    default: [],
    validate: (products: string[]) => products.length <= 20
  },
  ctaText: { type: String, required: true, trim: true, maxlength: 60, default: "Start Selling" },
  ctaLink: { type: String, required: true, trim: true, maxlength: 2048, default: "/products" },
  logoText: { type: String, required: true, trim: true, maxlength: 60, default: "ZAVI MART" },
  bgColor: { type: String, required: true, match: /^#[\da-f]{6}$/i, default: "#0A0A0A" },
  textColor: { type: String, required: true, match: /^#[\da-f]{6}$/i, default: "#FFFFFF" },
  goldColor: { type: String, required: true, match: /^#[\da-f]{6}$/i, default: "#D4AF37" },
  audioUrl: { type: String, default: "", maxlength: 5_700_000 },
  audioType: { type: String, enum: AD_AUDIO_TYPES, default: "punchy-beat" },
  beatSync: { type: Boolean, default: true },
  volume: { type: Number, min: 0, max: 100, default: 80 },
  customImages: {
    type: [{
      url: { type: String, required: true, maxlength: 500_000 },
      position: { type: String, enum: AD_IMAGE_POSITIONS, default: "foreground" },
      x: { type: Number, min: 0, max: 100, default: 50 },
      y: { type: Number, min: 0, max: 100, default: 50 },
      scale: { type: Number, min: 0.25, max: 2, default: 1 }
    }],
    default: []
  },
  animationStyle: { type: String, enum: AD_ANIMATION_STYLES, default: "kinetic-shopify" },
  animationSpeed: { type: String, enum: AD_ANIMATION_SPEEDS, default: "normal" },
  textEffect: { type: String, enum: AD_TEXT_EFFECTS, default: "none" },
  filterPreset: { type: String, enum: AD_FILTER_PRESETS, default: "none" },
  customBg: { type: String, default: "", maxlength: 2048 },
  overlayOpacity: { type: Number, min: 0, max: 100, default: 0 },
  brightness: { type: Number, min: 0, max: 200, default: 100 },
  contrast: { type: Number, min: 0, max: 200, default: 100 },
  blurAmount: { type: Number, min: 0, max: 20, default: 0 },
  goldTintOpacity: { type: Number, min: 0, max: 100, default: 20 },
  isActive: { type: Boolean, default: false, index: true },
  placement: { type: String, enum: ["homepage"], default: "homepage", index: true }
}, { timestamps: true, collection: "ads" });

adSchema.index({ placement: 1, isActive: 1, createdAt: -1 });

export type AdRecord = InferSchemaType<typeof adSchema>;
export type AdDocument = HydratedDocument<AdRecord>;

const Ad = mongoose.models.Ad
  ? mongoose.model<AdRecord>("Ad")
  : mongoose.model<AdRecord>("Ad", adSchema);

export default Ad;
