"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ExternalLink,
  Gift,
  Grid3X3,
  Globe,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
  X,
  Zap
} from "lucide-react";
import { useState } from "react";
import AdminBellWithSound from "../../components/admin/AdminBellWithSound";
import styles from "./admin-header.module.css";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Departments", href: "/admin/departments", icon: Grid3X3 },
  { label: "Value Sets", href: "/admin/bundles", icon: Gift },
  { label: "Flash Deals", href: "/admin/flash-deals", icon: Zap },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Users", href: "/admin/customers", icon: Users },
  { label: "Deals", href: "/admin/deals", icon: Boxes },
  { label: "Store Settings", href: "/admin/free-delivery", icon: Settings }
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function AdminToolbar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (pathname === "/admin/login") return null;

  return (
    <>
      <header className={`${styles.header} admin-toolbar`}>
        <button
          className={styles.menuButton}
          type="button"
          aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={drawerOpen}
          aria-controls="admin-mobile-drawer"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          {drawerOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link className={styles.brand} href="/admin" aria-label="ZaviMart Admin dashboard">
          <span className={styles.brandMark}>Z</span>
          <span className={styles.brandText}>ZaviMart <small>ADMIN PANEL</small></span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Admin sections">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              className={isActivePath(pathname, href) ? styles.activeLink : undefined}
              aria-current={isActivePath(pathname, href) ? "page" : undefined}
              href={href}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <a
            className={styles.storefrontDesktop}
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open live storefront in a new tab"
          >
            <Store size={16} aria-hidden="true" />
            <span>View Store</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <AdminBellWithSound />
        </div>
      </header>
      {drawerOpen && (
        <>
          <button
            className={styles.drawerBackdrop}
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
          />
          <nav
            className={styles.drawer}
            id="admin-mobile-drawer"
            aria-label="Admin navigation"
          >
            <div className={styles.drawerHeading}>Menu</div>
            {navItems.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                className={isActivePath(pathname, href) ? styles.drawerActiveLink : undefined}
                aria-current={isActivePath(pathname, href) ? "page" : undefined}
                href={href}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
              </Link>
            ))}
            <div className={styles.drawerDivider} />
            <div className={styles.drawerStoreLinks}>
              <a
                className={styles.storefrontCard}
                href="/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.storefrontIcon}>
                  <Store size={16} aria-hidden="true" />
                </span>
                <span className={styles.storefrontCopy}>
                  <span className={styles.storefrontTitle}>View Store</span>
                  <span className={styles.storefrontSubtitle}>Live storefront</span>
                </span>
                <ExternalLink className={styles.storefrontExternal} size={16} aria-hidden="true" />
              </a>
              <a className={styles.storefrontDomain} href="/" target="_blank" rel="noopener noreferrer">
                <Globe size={14} aria-hidden="true" />
                <span>zavimart.com - Open Store</span>
              </a>
            </div>
            <div className={styles.drawerFooter}>
              <span className={styles.liveIndicator} />
              Store is live
            </div>
          </nav>
        </>
      )}
    </>
  );
}
