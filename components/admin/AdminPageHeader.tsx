import type { ReactNode } from "react";
import { Search } from "lucide-react";
import styles from "./AdminUI.module.css";

type AdminPageHeaderProps = {
  title: string;
  count?: number | string;
  description?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  action?: ReactNode;
};

export default function AdminPageHeader({
  title,
  count,
  description,
  searchValue,
  searchPlaceholder = "Search...",
  onSearchChange,
  action
}: AdminPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.heading}>
        <h1>
          {title}
          {count !== undefined && <span className={styles.count}>({count})</span>}
        </h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      <div className={styles.controls}>
        {onSearchChange && (
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label={searchPlaceholder}
              value={searchValue ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        )}
        {action}
      </div>
    </header>
  );
}
