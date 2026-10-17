export const AD_AUDIO_TYPES = ["punchy-beat", "luxury-tick", "deep-bass", "custom"] as const;

export type AdAudioType = (typeof AD_AUDIO_TYPES)[number];

export type AdProductPreview = {
  id: string;
  title: string;
  image: string;
  price: number;
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
  isActive: false,
  placement: "homepage"
};
