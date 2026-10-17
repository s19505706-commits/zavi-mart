import type { Metadata } from "next";
import type { ReactNode } from "react";
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
      <div className="admin-main">
        {children}
        <footer className="admin-footer">
          <span>ZAVI MART <span className="admin-footer-divider">/</span> ADMIN</span>
          <span>Premium Store Management</span>
        </footer>
      </div>
    </div>
  );
}
