"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./AdminUI.module.css";

type AdminDrawerProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AdminDrawer({ title, open, onClose, children, footer }: AdminDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={styles.drawerBackdrop} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.drawerHeader}>
          <h2>{title}</h2>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close drawer">
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
        {footer && <footer className={styles.drawerFooter}>{footer}</footer>}
      </section>
    </div>
  );
}
