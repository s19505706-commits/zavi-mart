import type { ButtonHTMLAttributes } from "react";
import styles from "./AdminButton.module.css";

export type AdminButtonVariant = "primary" | "secondary" | "danger";

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
};

export default function AdminButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
