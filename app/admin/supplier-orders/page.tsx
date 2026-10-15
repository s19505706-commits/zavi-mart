import { redirect } from "next/navigation";

export default function SupplierOrdersRedirect() {
  redirect("/admin/orders?tab=supplier");
}
