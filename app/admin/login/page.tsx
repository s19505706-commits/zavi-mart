"use client";

import { useState, type FormEvent } from "react";

export default function AdminLoginPage() {
  const [adminKey, setAdminKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey })
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("success" in result) ||
        result.success !== true
      ) {
        const message = typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "string"
          ? result.error
          : "Unable to sign in as admin.";
        setErrorMessage(message);
        return;
      }

      window.location.assign("/admin");
    } catch (error) {
      console.error("Unable to complete admin sign-in.", error);
      setErrorMessage("We couldn't reach the sign-in service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="account-panel login-panel" aria-labelledby="admin-login-title">
        <div className="panel-heading">
          <div>
            <h1 id="admin-login-title">ZaviMart Admin Access</h1>
          </div>
        </div>
        <p className="account-intro">Enter the server-configured admin key to continue.</p>
        <form className="sign-in-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-key">
            Admin key
            <input
              id="admin-key"
              name="admin-key"
              type="password"
              autoComplete="current-password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              required
            />
          </label>
          <button className="account-dismiss" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <p className="sign-in-status" role="alert">{errorMessage}</p>
        </form>
      </section>
    </main>
  );
}
