"use client";

import { AUTH_ENDPOINTS } from "@/lib/endpoints/auth";
import {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAPI } from "@/lib/api/client";
import { clearStoredBranchId, setStoredBranchId } from "@/lib/branch-storage";
import { resetSessionExpiredNotice } from "@/lib/auth/session-expiry";
import type { SessionUser } from "@/types/auth";

type AuthContextType = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  login: (user: SessionUser, returnPath?: string | null) => void;
  logout: () => Promise<void>;
  activeBranchId: number | null;
  setActiveBranchId: (id: number | null) => void;
  isInitialized: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
  initialUser?: SessionUser;
  hydratedFromServer?: boolean;
};

export function AuthProvider({
  children,
  initialUser,
  hydratedFromServer = false,
}: AuthProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(initialUser ?? null);
  const [activeBranchId, setActiveBranchIdState] = useState<number | null>(initialUser?.branchId ?? null);
  const [isInitialized, setIsInitialized] = useState(hydratedFromServer);
  const router = useRouter();
  const queryClient = useQueryClient();

  const setActiveBranchId = useCallback(
    (id: number | null) => {
      startTransition(() => setActiveBranchIdState(id));
      if (user?.role === "SUPER_ADMIN") {
        setStoredBranchId(id);
      }
    },
    [user?.role],
  );

  useEffect(() => {
    if (hydratedFromServer) return;

    let cancelled = false;

    fetchAPI(AUTH_ENDPOINTS.me)
      .then((profile: SessionUser) => {
        if (cancelled) return;
        setUser(profile);
        setActiveBranchIdState(profile.branchId ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setActiveBranchIdState(null);
      })
      .finally(() => {
        if (!cancelled) setIsInitialized(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hydratedFromServer]);

  const login = useCallback(
    (newUser: SessionUser, returnPath?: string | null) => {
      setUser(newUser);
      setActiveBranchIdState(newUser.branchId ?? null);
      setIsInitialized(true);
      resetSessionExpiredNotice();
      const landing =
        returnPath ?? (newUser.role === "STAFF" ? "/pos/terminal" : "/");
      router.push(landing);
      toast.success("Logged in successfully");
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await fetchAPI(AUTH_ENDPOINTS.logout, { method: "POST" });
    } catch {
      // Clear client state even if the server call fails.
    }
    setUser(null);
    setActiveBranchIdState(null);
    queryClient.clear();
    clearStoredBranchId();
    resetSessionExpiredNotice();
    router.push("/login");
    toast.success("Logged out successfully");
  }, [router, queryClient]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      login,
      logout,
      activeBranchId,
      setActiveBranchId,
      isInitialized,
    }),
    [user, login, logout, activeBranchId, setActiveBranchId, isInitialized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
