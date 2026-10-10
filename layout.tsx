import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ZaviMart | Smart Shopping in Pakistan",
  description:
    "Shop electronics, fashion, home essentials, beauty, groceries, and more at ZaviMart.",
  icons: {
    icon: "/zavimart-favicon-transparent.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
