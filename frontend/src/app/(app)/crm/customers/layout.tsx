"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { AccessDeniedState } from "@/components/shared/access-denied-state";

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={["SUPER_ADMIN", "MANAGER"]}
      fallback={
        <AccessDeniedState
          description="Manager or Super Admin access is required to browse the member directory. Look a member up by phone at the POS instead."
          backHref="/pos/terminal"
          backLabel="Back to POS"
        />
      }
    >
      {children}
    </RoleGuard>
  );
}
