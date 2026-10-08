import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const poppins = Poppins({
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: "ZaviMart | Smart Shopping in Pakistan",
  description:
    "Discover flash deals and hot offers across mobiles, electronics, fashion, home, beauty, and more.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "ZaviMart",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/zavimart-favicon-transparent.png" },
      { url: "/zavimart-icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/zavimart-apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0A2A5E"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={poppins.variable}>{children}</body>
    </html>
  );
}
