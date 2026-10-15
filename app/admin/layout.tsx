import type { ReactNode } from "react";
import AdminToolbar from "./AdminToolbar";
import "./admin-theme.css";
import "../../components/admin/admin-compact.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-app">
      <AdminToolbar />
      {children}
    </div>
  );
}
