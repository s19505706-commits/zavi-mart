"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronDown,
  ExternalLink,
  Flame,
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
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import AdminBellWithSound from "../../components/admin/AdminBellWithSound";
import styles from "./admin-header.module.css";

type AdminLinkItem = { label: string; href: string; icon: LucideIcon };
type AdminMenuItem = AdminLinkItem | {
  label: string;
  icon: LucideIcon;
  children: AdminLinkItem[];
};

const menuItems: AdminMenuItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Departments", href: "/admin/departments", icon: Grid3X3 },
  {
    label: "Deals",
    icon: Boxes,
    children: [
      { label: "Flash Deals", href: "/admin/flash-deals", icon: Zap },
      { label: "Hot Deals", href: "/admin/hot-deals", icon: Flame },
      { label: "Value Sets", href: "/admin/bundles", icon: Gift }
    ]
  },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Store Settings", href: "/admin/settings", icon: Settings }
];

function isActivePath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function AdminToolbar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dealsOpen, setDealsOpen] = useState(true);
  const isHotDealsActive = pathname === "/admin/hot-deals";

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
          <span className={styles.brandText}>ZAVI MART <small>ADMIN PANEL</small></span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Admin sections">
          {menuItems.map((item) => {
            const Icon = item.icon;
            if ("children" in item) {
              const childActive = item.children.some((child) =>
                child.href === "/admin/hot-deals"
                  ? isHotDealsActive
                  : isActivePath(pathname, child.href)
              );
              return (
                <div className={styles.dealsGroup} key={item.label}>
                  <button
                    className={`${styles.dealsToggle} ${childActive ? styles.dealsToggleActive : ""}`}
                    type="button"
                    aria-expanded={dealsOpen || childActive}
                    aria-controls="admin-desktop-deals"
                    onClick={() => setDealsOpen((open) => childActive ? true : !open)}
                  >
                    <span><Icon size={16} aria-hidden="true" />{item.label}</span>
                    <ChevronDown className={dealsOpen || childActive ? styles.chevronOpen : ""} size={16} aria-hidden="true" />
                  </button>
                  {(dealsOpen || childActive) && (
                    <div className={styles.dealsChildren} id="admin-desktop-deals">
                      {item.children.map(({ label, href, icon: ChildIcon }) => {
                        const active = href === "/admin/hot-deals"
                          ? isHotDealsActive
                          : isActivePath(pathname, href);
                        return (
                          <Link
                            key={href}
                            className={active ? styles.activeLink : undefined}
                            aria-current={active ? "page" : undefined}
                            href={href}
                          >
                            <ChildIcon size={15} aria-hidden="true" />
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                className={active ? styles.activeLink : undefined}
                aria-current={active ? "page" : undefined}
                href={item.href}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
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
            {menuItems.map((item) => {
              const Icon = item.icon;
              if ("children" in item) {
                const childActive = item.children.some((child) =>
                  child.href === "/admin/hot-deals"
                    ? isHotDealsActive
                    : isActivePath(pathname, child.href)
                );
                return (
                  <div className={styles.drawerDealsGroup} key={item.label}>
                    <button
                      className={`${styles.drawerDealsToggle} ${childActive ? styles.drawerDealsToggleActive : ""}`}
                      type="button"
                      aria-expanded={dealsOpen || childActive}
                      aria-controls="admin-mobile-deals"
                      onClick={() => setDealsOpen((open) => childActive ? true : !open)}
                    >
                      <span><Icon size={19} aria-hidden="true" />{item.label}</span>
                      <ChevronDown className={dealsOpen || childActive ? styles.chevronOpen : ""} size={16} aria-hidden="true" />
                    </button>
                    {(dealsOpen || childActive) && (
                      <div className={styles.drawerDealsChildren} id="admin-mobile-deals">
                        {item.children.map(({ label, href, icon: ChildIcon }) => {
                          const active = href === "/admin/hot-deals"
                            ? isHotDealsActive
                            : isActivePath(pathname, href);
                          return (
                            <Link
                              key={href}
                              className={active ? styles.drawerActiveLink : undefined}
                              aria-current={active ? "page" : undefined}
                              href={href}
                              onClick={() => setDrawerOpen(false)}
                            >
                              <ChildIcon size={17} aria-hidden="true" />
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  className={active ? styles.drawerActiveLink : undefined}
                  aria-current={active ? "page" : undefined}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon size={19} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
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
