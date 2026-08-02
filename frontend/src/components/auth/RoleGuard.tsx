"use client";

import { useAuth } from "@/context/AuthContext";
import { QueryLoadingPanel } from "@/components/shared/query-states";

type RoleGuardProps = {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user, isInitialized } = useAuth();

  // Never show "Access Denied" to a legitimate user just because the session is still resolving.
  if (!isInitialized) {
    return <QueryLoadingPanel message="Checking permissions" />;
  }

  if (!user || !user.role) {
    return fallback;
  }

  if (allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return fallback;
}
