import Link from "next/link";
import type { ReactNode } from "react";

export default function StoreInfoPage({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="store-info-page">
      <Link href="/" aria-label="Back to ZaviMart home">← ZaviMart</Link>
      <p className="section-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
