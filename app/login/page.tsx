"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { signIn } = useAuth();
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage("Enter your email address and password.");
      return;
    }

    try {
      signIn({ email: email.trim() });
      router.push("/");
    } catch (error) {
      console.error("Unable to save the signed-in user.", error);
      setErrorMessage("We couldn't save your sign-in. Please try again.");
    }
  }

  return (
    <main className="login-page">
      <section className="account-panel login-panel" aria-labelledby="login-title">
        <div className="panel-heading">
          <div>
            <span className="section-eyebrow">Customer account</span>
            <h1 id="login-title">Sign in to ZaviMart</h1>
          </div>
        </div>
        <p className="account-intro">Access your orders and saved products.</p>
        <form className="sign-in-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="login-email">
            Email address
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor="login-password">
            Password
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="account-dismiss" type="submit">Sign in</button>
          <p className="sign-in-status" role="alert">{errorMessage}</p>
        </form>
        <Link className="login-home-link" href="/">Back to shopping</Link>
      </section>
    </main>
  );
}
