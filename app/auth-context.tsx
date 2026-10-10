"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const AUTH_STORAGE_KEY = "zavimart-user";

export type AuthUser = {
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  signIn: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!savedUser) return;

      const parsedUser: unknown = JSON.parse(savedUser);
      if (
        typeof parsedUser === "object" &&
        parsedUser !== null &&
        "email" in parsedUser &&
        typeof parsedUser.email === "string"
      ) {
        setUser({ email: parsedUser.email });
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Unable to restore the saved user.", error);
    }
  }, []);

  function signIn(nextUser: AuthUser) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }

  return (
    <AuthContext.Provider value={{ user, signIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
