import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AdminUser } from "../types";
import {
  AUTH_ADMIN_KEY,
  AUTH_TOKEN_KEY,
  fetchCurrentAdmin,
  loginAdmin,
} from "../services/api";

type AuthContextValue = {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredAdmin = (): AdminUser | null => {
  const raw = localStorage.getItem(AUTH_ADMIN_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    localStorage.removeItem(AUTH_ADMIN_KEY);
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
  const [admin, setAdmin] = useState<AdminUser | null>(() => readStoredAdmin());

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_ADMIN_KEY);
    setToken(null);
    setAdmin(null);
  };

  const login = async (email: string, password: string) => {
    const result = await loginAdmin(email, password);

    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    localStorage.setItem(AUTH_ADMIN_KEY, JSON.stringify(result.admin));
    setToken(result.token);
    setAdmin(result.admin);
  };

  useEffect(() => {
    const handleExpired = () => {
      logout();
      toast.error("Session expired. Please log in again.");
    };

    window.addEventListener("quant-auth-expired", handleExpired);
    return () => window.removeEventListener("quant-auth-expired", handleExpired);
  }, []);

  useEffect(() => {
    if (!token) return;

    fetchCurrentAdmin()
      .then((currentAdmin) => {
        localStorage.setItem(AUTH_ADMIN_KEY, JSON.stringify(currentAdmin));
        setAdmin(currentAdmin);
      })
      .catch(() => logout());
  }, [token]);

  const value = useMemo(
    () => ({
      admin,
      token,
      isAuthenticated: Boolean(token && admin),
      login,
      logout,
    }),
    [admin, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
