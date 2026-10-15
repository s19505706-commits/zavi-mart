"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type BundleProduct = {
  productId: string;
  title: string;
  image: string;
  category: string;
  originalPrice: number;
};

type BundleDeal = {
  id: string;
  title: string;
  image: string;
  products: BundleProduct[];
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  badge: string;
  validTill: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMoney(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

function parseBundle(value: unknown, dealId: string): BundleDeal | null {
  if (!isRecord(value) || value.hotDealId !== dealId || value.dealType !== "bundle" ||
      typeof value.price !== "number" || typeof value.originalPrice !== "number") return null;
  const products = Array.isArray(value.dealProducts)
    ? value.dealProducts.flatMap((entry): BundleProduct[] => {
      if (!isRecord(entry) || typeof entry.productId !== "string" || typeof entry.title !== "string" ||
          typeof entry.originalPrice !== "number") return [];
      return [{
        productId: entry.productId,
        title: entry.title,
        image: typeof entry.image === "string" ? entry.image : "",
        category: typeof entry.category === "string" ? entry.category : "General",
        originalPrice: entry.originalPrice
      }];
    })
    : [];
  if (products.length < 2 || products.length > 4) return null;
  return {
    id: dealId,
    title: typeof value.bundleTitle === "string" ? value.bundleTitle : String(value.title ?? "Bundle Deal"),
    image: typeof value.bundleImage === "string" ? value.bundleImage : "",
    products,
    dealPrice: value.price,
    originalPrice: value.originalPrice,
    discountPercent: typeof value.discountPercent === "number" ? value.discountPercent : 0,
    badge: typeof value.badge === "string" ? value.badge : "Bundle Deal",
    validTill: typeof value.validTill === "string" ? value.validTill : null
  };
}

export default function HotDealBundlePage() {
  const params = useParams<{ id: string }>();
  const dealId = params.id;
  const [deal, setDeal] = useState<BundleDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderAmount, setOrderAmount] = useState<number | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", city: "" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hot-deals/${encodeURIComponent(dealId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !isRecord(result.deal)) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error : "Could not load this bundle deal.");
        }
        const found = parseBundle(result.deal, dealId);
        if (!found) throw new Error("This bundle deal is no longer available.");
        if (!cancelled) setDeal(found);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load this bundle deal.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deal) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/hot-deals/${encodeURIComponent(deal.id)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer })
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || typeof result.orderId !== "string") {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error : "Could not place this bundle order.");
      }
      setOrderId(result.orderId);
      setOrderAmount(typeof result.amount === "number" ? result.amount : null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not place this bundle order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl p-6 text-gray-600">Loading bundle deal...</main>;
  }
  if (!deal) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-red-700" role="alert">{error || "This bundle deal is unavailable."}</p>
        <Link className="mt-4 inline-block text-blue-800 underline" href="/">Return to ZaviMart</Link>
      </main>
    );
  }
  const savings = deal.originalPrice - deal.dealPrice;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:py-10">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl bg-white p-5 shadow-sm md:p-7">
          <Link href="/" className="text-sm font-semibold text-[#1a237e]">← Back to ZaviMart</Link>
          <div className="mt-5 overflow-hidden rounded-xl bg-slate-50">
            {deal.image ? (
              <img src={deal.image} alt={deal.title} className="h-64 w-full object-contain md:h-80" />
            ) : (
              <div className="grid h-64 grid-cols-2 gap-2 p-3 md:h-80">
                {deal.products.map((product) => product.image
                  ? <img key={product.productId} src={product.image} alt="" className="h-full w-full rounded-lg object-cover" />
                  : <div key={product.productId} className="rounded-lg bg-slate-200" />)}
              </div>
            )}
          </div>
          <span className="mt-5 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
            {deal.badge} · Pack of {deal.products.length}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">{deal.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{deal.products.length} products in one combo</p>
          <ul className="mt-5 divide-y divide-slate-100">
            {deal.products.map((product) => (
              <li className="flex items-center gap-3 py-3" key={product.productId}>
                {product.image && <img src={product.image} alt="" className="h-14 w-14 rounded-lg bg-slate-100 object-cover" />}
                <span className="flex-1 text-sm font-medium text-slate-800">{product.title}</span>
                <span className="text-sm text-slate-500">{formatMoney(product.originalPrice)}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <h2 className="text-lg font-bold text-[#1a237e]">Bundle summary</h2>
          <div className="mt-4 flex justify-between text-sm text-slate-600"><span>Original total</span><span className="line-through">{formatMoney(deal.originalPrice)}</span></div>
          <div className="mt-2 flex justify-between text-sm text-green-700"><span>You save ({deal.discountPercent}% OFF)</span><span>{formatMoney(savings)}</span></div>
          <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-lg font-bold"><span>Bundle price</span><span>{formatMoney(deal.dealPrice)}</span></div>
          <p className="mt-1 text-xs text-slate-500">Cash on Delivery. Delivery fee is calculated using the current shipping settings.</p>

          {orderId ? (
            <div className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-800" role="status">
              <strong>Your bundle order is confirmed.</strong>
              <p className="mt-1">Order ID: {orderId}. Pay {orderAmount === null ? "cash" : formatMoney(orderAmount)} on delivery.</p>
              <Link className="mt-3 inline-block font-semibold underline" href="/">Continue shopping</Link>
            </div>
          ) : (
            <form className="mt-6 space-y-3" onSubmit={submitOrder}>
              <h3 className="font-semibold text-slate-800">Delivery details</h3>
              <input required maxLength={100} placeholder="Your name" autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} />
              <input required maxLength={24} type="tel" placeholder="Phone number" autoComplete="tel" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} />
              <textarea required maxLength={240} placeholder="Street address" autoComplete="street-address" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} />
              <input required maxLength={100} placeholder="City" autoComplete="address-level2" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={customer.city} onChange={(event) => setCustomer((current) => ({ ...current, city: event.target.value }))} />
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <button className="w-full rounded-lg bg-[#d90429] px-4 py-3 font-bold text-white disabled:opacity-60" type="submit" disabled={submitting}>
                {submitting ? "Placing order..." : "Buy Bundle — Cash on Delivery"}
              </button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
