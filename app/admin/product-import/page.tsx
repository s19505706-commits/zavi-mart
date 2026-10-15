import { redirect } from "next/navigation";

export default function ProductImportRedirect() {
  redirect("/admin?tab=import");
}
