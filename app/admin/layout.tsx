import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import AdminToolbar from "./AdminToolbar";
import "./admin-theme.css";
import "../../components/admin/admin-compact.css";

export const metadata: Metadata = {
  manifest: "/admin-manifest.json"
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-app">
      <AdminToolbar />
      {children}
      <Toaster position="top-right" richColors />
    </div>
  );
}
