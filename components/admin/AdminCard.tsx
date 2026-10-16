import type { HTMLAttributes, ReactNode } from "react";
import styles from "./AdminUI.module.css";

type AdminCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "div" | "section" | "article";
};

export default function AdminCard({
  children,
  as: Element = "section",
  className,
  ...props
}: AdminCardProps) {
  return (
    <Element className={["admin-card", styles.card, className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Element>
  );
}
