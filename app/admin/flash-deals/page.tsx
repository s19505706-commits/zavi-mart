import { redirect } from "next/navigation";

export default function LegacyFlashDealsPage() {
  redirect("/admin/deals?tab=flash");
}
