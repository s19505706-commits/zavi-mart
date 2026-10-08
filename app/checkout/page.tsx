import type { Metadata } from "next";
import CheckoutForm from "./CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout | ZaviMart",
  description: "Complete your ZaviMart order."
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
