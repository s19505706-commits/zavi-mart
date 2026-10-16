import type { HTMLAttributes, ReactNode } from "react";
import styles from "./AdminUI.module.css";

type AdminTableProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function AdminTable({ children, className, ...props }: AdminTableProps) {
  return (
    <div className={["admin-table", styles.tableWrap, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
