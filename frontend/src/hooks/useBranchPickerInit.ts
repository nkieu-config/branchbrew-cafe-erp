"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import {
  getStoredBranchSelection,
  resolveDefaultBranchId,
} from "@/lib/branch-storage";
import type { Branch } from "@/types/api";

export function useBranchPickerInit() {
  const { user, activeBranchId, setActiveBranchId, isInitialized } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const { data: branchesData = [], isLoading: isLoadingBranches } = useBranches(isSuperAdmin);
  const branches = branchesData as Branch[];
  const appliedForUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      appliedForUserId.current = null;
    }
  }, [user]);

  useEffect(() => {
    if (!isSuperAdmin || !isInitialized || branches.length === 0 || !user) return;
    if (appliedForUserId.current === user.id) return;
    appliedForUserId.current = user.id;

    const selection = getStoredBranchSelection();
    if (selection === "unset") {
      const defaultId = resolveDefaultBranchId(branches);
      if (defaultId != null) setActiveBranchId(defaultId);
      return;
    }

    if (selection === null) {
      setActiveBranchId(null);
      return;
    }

    if (branches.some((b) => b.id === selection)) {
      setActiveBranchId(selection);
    } else {
      const defaultId = resolveDefaultBranchId(branches);
      if (defaultId != null) setActiveBranchId(defaultId);
    }
  }, [isSuperAdmin, isInitialized, branches, setActiveBranchId, user]);

  return {
    isSuperAdmin,
    branches,
    isLoadingBranches,
    activeBranchId,
    setActiveBranchId,
  };
}
