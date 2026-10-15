import { redirect } from "next/navigation";

export default function LegacyHotDealsPage() {
  redirect("/admin/deals?tab=hot");
}
