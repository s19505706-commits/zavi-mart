"use client";

import { useEffect, useState } from "react";
import FlashDealsPanel from "./FlashDealsPanel";
import HotDealsPanel from "./HotDealsPanel";
import styles from "./deals.module.css";

type DealTab = "flash" | "hot";

function tabFromUrl(): DealTab {
  return new URLSearchParams(window.location.search).get("tab") === "hot" ? "hot" : "flash";
}

export default function AdminDealsPage() {
  const [activeTab, setActiveTab] = useState<DealTab>("flash");

  useEffect(() => {
    const syncTab = () => setActiveTab(tabFromUrl());
    syncTab();
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);

  function selectTab(tab: DealTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState(null, "", url);
  }

  return (
    <div className={`${styles.page} admin-content`}>
      <div className={styles.tabs} role="tablist" aria-label="Deal management">
        <button
          id="flash-deals-tab"
          className={activeTab === "flash" ? styles.activeTab : ""}
          type="button"
          role="tab"
          aria-selected={activeTab === "flash"}
          aria-controls="flash-deals-panel"
          onClick={() => selectTab("flash")}
        >
          Flash Deals
        </button>
        <button
          id="hot-deals-tab"
          className={activeTab === "hot" ? styles.activeTab : ""}
          type="button"
          role="tab"
          aria-selected={activeTab === "hot"}
          aria-controls="hot-deals-panel"
          onClick={() => selectTab("hot")}
        >
          Hot Deals
        </button>
      </div>
      <section
        id="flash-deals-panel"
        role="tabpanel"
        aria-labelledby="flash-deals-tab"
        hidden={activeTab !== "flash"}
      >
        {activeTab === "flash" && <FlashDealsPanel />}
      </section>
      <section
        id="hot-deals-panel"
        role="tabpanel"
        aria-labelledby="hot-deals-tab"
        hidden={activeTab !== "hot"}
      >
        {activeTab === "hot" && <HotDealsPanel />}
      </section>
    </div>
  );
}
