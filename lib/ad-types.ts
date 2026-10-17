export const AD_AUDIO_TYPES = ["punchy-beat", "luxury-tick", "deep-bass", "custom", "none"] as const;

export type AdAudioType = (typeof AD_AUDIO_TYPES)[number];
export const AD_ANIMATION_STYLES = ["kinetic-shopify", "fade-up", "zoom-in", "slide-left", "typewriter", "bounce", "rotate-3d"] as const;
export type AdAnimationStyle = (typeof AD_ANIMATION_STYLES)[number];
export const AD_ANIMATION_SPEEDS = ["slow", "normal", "fast", "beat-sync"] as const;
export type AdAnimationSpeed = (typeof AD_ANIMATION_SPEEDS)[number];
export const AD_TEXT_EFFECTS = ["none", "glow-gold", "stroke", "shadow-3d", "gradient-gold"] as const;
export type AdTextEffect = (typeof AD_TEXT_EFFECTS)[number];
export const AD_FILTER_PRESETS = ["none", "luxury-dark", "gold-tint", "blur-bg", "grayscale-luxury", "vintage", "neon-glow", "cinematic"] as const;
export type AdFilterPreset = (typeof AD_FILTER_PRESETS)[number];
export const AD_IMAGE_POSITIONS = ["background", "foreground", "floating"] as const;
export type AdImagePosition = (typeof AD_IMAGE_POSITIONS)[number];
export const AD_DISPLAY_LOCATIONS = ["homepage-hero", "product-page", "fullscreen"] as const;
export type AdDisplayLocation = (typeof AD_DISPLAY_LOCATIONS)[number];
export const AD_FONT_STYLES = ["black", "bold", "luxury-serif"] as const;
export type AdFontStyle = (typeof AD_FONT_STYLES)[number];
export const AD_TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
export type AdTextAlignment = (typeof AD_TEXT_ALIGNMENTS)[number];
export const AD_PRODUCT_ANIMATIONS = ["float", "slide", "rotate-3d", "static"] as const;
export type AdProductAnimation = (typeof AD_PRODUCT_ANIMATIONS)[number];
export const AD_PRODUCT_CARD_STYLES = ["minimal", "luxury-gold", "glass", "neon"] as const;
export type AdProductCardStyle = (typeof AD_PRODUCT_CARD_STYLES)[number];
export const AD_DURATIONS = ["6", "8", "10", "loop"] as const;
export type AdDuration = (typeof AD_DURATIONS)[number];

export type AdProductPreview = {
  id: string;
  title: string;
  image: string;
  price: number;
};

export type AdCustomImage = {
  url: string;
  position: AdImagePosition;
  x: number;
  y: number;
  scale: number;
};

export type KineticAdInput = Partial<Omit<AdData, "titleLines" | "secondLines" | "finalLines" | "products" | "productDetails">> & {
  titleLines?: string | string[];
  secondLines?: string | string[];
  finalLines?: string | string[];
  products?: Array<string | AdProductPreview>;
  productDetails?: AdProductPreview[];
};

export type AdData = {
  id?: string;
  campaignName: string;
  displayLocation: AdDisplayLocation;
  titleLines: string[];
  secondLines: string[];
  finalLines: string[];
  products: string[];
  productDetails?: AdProductPreview[];
  ctaText: string;
  ctaLink: string;
  logoText: string;
  bgColor: string;
  textColor: string;
  goldColor: string;
  audioUrl: string;
  audioType: AdAudioType;
  beatSync: boolean;
  volume: number;
  customImages: AdCustomImage[];
  animationStyle: AdAnimationStyle;
  animationSpeed: AdAnimationSpeed;
  textEffect: AdTextEffect;
  filterPreset: AdFilterPreset;
  customBg: string;
  overlayOpacity: number;
  brightness: number;
  contrast: number;
  blurAmount: number;
  goldTintOpacity: number;
  fontStyle: AdFontStyle;
  textSize: number;
  textAlignment: AdTextAlignment;
  productAnimation: AdProductAnimation;
  productCardStyle: AdProductCardStyle;
  duration: AdDuration;
  beatIntensity: number;
  isActive: boolean;
  placement: "homepage";
  createdAt?: string;
  updatedAt?: string;
};

export function normalizeAdLines(value: unknown, fallback: string[]): string[] {
  const entries = typeof value === "string"
    ? value.split(/[-,]/)
    : Array.isArray(value) ? value : [];
  const lines = entries
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => entry.split(/[-,]/))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
}

export const DEFAULT_AD: AdData = {
  campaignName: "New campaign",
  displayLocation: "homepage-hero",
  titleLines: ["WHAT", "EVER", "YOU", "SELL"],
  secondLines: ["SELL", "MORE", "MORE", "MORE", "MORE"],
  finalLines: ["THE", "WORLD'S", "BEST", "CHECKOUT"],
  products: [],
  productDetails: [],
  ctaText: "Start Selling",
  ctaLink: "/products",
  logoText: "ZAVI MART",
  bgColor: "#0A0A0A",
  textColor: "#FFFFFF",
  goldColor: "#D4AF37",
  audioUrl: "",
  audioType: "punchy-beat",
  beatSync: true,
  volume: 80,
  customImages: [],
  animationStyle: "kinetic-shopify",
  animationSpeed: "normal",
  textEffect: "none",
  filterPreset: "none",
  customBg: "",
  overlayOpacity: 0,
  brightness: 100,
  contrast: 100,
  blurAmount: 0,
  goldTintOpacity: 20,
  fontStyle: "black",
  textSize: 64,
  textAlignment: "center",
  productAnimation: "float",
  productCardStyle: "luxury-gold",
  duration: "10",
  beatIntensity: 50,
  isActive: false,
  placement: "homepage"
};
