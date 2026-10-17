import type { Metadata } from "next";
import CheckoutForm from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout | ZaviMart",
  description: "Complete your ZaviMart order."
};

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <CheckoutForm />;
}
