import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import { AuthProvider } from "./auth-context";
import { Toaster } from "sonner";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://zavimart.com"),
  title: {
    default: "Zavi Collection | Smart Shopping",
    template: "%s | Zavi Collection"
  },
  description:
    "Shop the Zavi Collection for carefully selected products, great offers, and convenient delivery across Pakistan.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "ZaviMart",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/logos/zavimart-favicon-transparent.png" },
      { url: "/logos/zavimart-icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/logos/zavimart-apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0A2A5E"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={poppins.variable}>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
