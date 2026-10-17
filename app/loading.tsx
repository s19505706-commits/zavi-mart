import styles from "./loading.module.css";

export default function Loading() {
  return (
    <main className={styles.screen} role="status" aria-label="Loading">
      <span className={styles.spinner} aria-hidden="true" />
    </main>
  );
}
