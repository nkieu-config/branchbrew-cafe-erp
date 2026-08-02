"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useHrUsers, useCreateUser, useUpdateUser } from "@/hooks/domains/useHrQueries";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { AccessDeniedState } from "@/components/shared/access-denied-state";
import { OrganizationUsersTable } from "@/components/organization/OrganizationUsersTable";
import {
  UserFormModal,
  type UserFormValues,
} from "@/components/organization/UserFormModal";
import { Button } from "@/components/ui/button";
import {
  type EmployeeRoleFilter,
  type OrgUserBranchFilter,
  filterEmployees,
} from "@/lib/filters/employee-filters";
import { getErrorMessage } from "@/lib/errors";
import { hubCtaClassName } from "@/lib/theme/hub-primitives";
import { organizationSectionPanelClassName } from "@/lib/theme/organization";
import { useListUrlState } from "@/hooks/useListUrlState";
import type {
  Branch,
  CreateUserPayload,
  User,
} from "@/types/api";

export default function UsersPageClient({ embedded = false }: { embedded?: boolean }) {
  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    error: usersQueryError,
    refetch: refetchUsers,
    isFetching: usersFetching,
  } = useHrUsers();
  const {
    data: branches,
    isLoading: branchesLoading,
    isError: branchesError,
    error: branchesQueryError,
    refetch: refetchBranches,
    isFetching: branchesFetching,
  } = useBranches();

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { values, setValue, reset, isDefault } = useListUrlState({
    q: "",
    role: "ALL",
    branch: "ALL",
  });
  const search = values.q;
  const setSearch = (next: string) => setValue("q", next);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const roleFilter = values.role as EmployeeRoleFilter;
  const branchFilter: OrgUserBranchFilter =
    values.branch === "ALL" || values.branch === "hq"
      ? values.branch
      : Number(values.branch);

  const branchList = (branches as Branch[] | undefined) ?? [];
  const userList = (users as User[] | undefined) ?? [];

  const branchNameById = useMemo(
    () => new Map(branchList.map((branch) => [branch.id, branch.name])),
    [branchList],
  );

  const filteredUsers = useMemo(
    () =>
      filterEmployees(userList, {
        search: deferredSearch,
        roleFilter,
        employmentTypeFilter: "ALL",
        rateFilter: "ALL",
        branchFilter,
        branchNames: branchNameById,
      }),
    [
      userList,
      deferredSearch,
      roleFilter,
      branchFilter,
      branchNameById,
    ],
  );

  const isLoading = usersLoading || branchesLoading;
  const isError = usersError || branchesError;
  const error = usersQueryError ?? branchesQueryError;
  const isFetching = usersFetching || branchesFetching;

  const hasActiveFilters = !isDefault;


  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleSave = async (payload: UserFormValues) => {
    try {
      const body: CreateUserPayload = {
        ...payload,
        branchId: payload.branchId,
      };
      if (!body.password) delete body.password;

      if (editingUser) {
        await updateMutation.mutateAsync({ id: editingUser.id, ...body });
        toast.success("User updated");
      } else {
        if (!payload.password) {
          toast.error("Password is required for new users");
          return;
        }
        await createMutation.mutateAsync({ ...body, password: payload.password });
        toast.success("User created");
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save user"));
      throw err;
    }
  };

  const content = (
    <div className="space-y-4 w-full max-w-6xl mx-auto">
      <div className="flex justify-end">
        <Button
          className={hubCtaClassName("organization", "min-h-[44px]")}
          onClick={handleAddNew}
        >
          <Plus className="w-4 h-4 mr-2" aria-hidden />
          Add user
        </Button>
      </div>

      <HubListPage className={organizationSectionPanelClassName()}>
        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load users.") : undefined}
          onRetry={() => {
            void refetchUsers();
            void refetchBranches();
          }}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, role…"
          showReset={hasActiveFilters}
          onReset={reset}
          filters={
            <>
              <ListFilterSelect
                value={roleFilter}
                onValueChange={(value) => setValue("role", value)}
                ariaLabel="Filter by role"
                widthClassName="w-full sm:w-[160px]"
                options={[
                  { value: "ALL", label: "All roles" },
                  { value: "SUPER_ADMIN", label: "Super Admin" },
                  { value: "MANAGER", label: "Manager" },
                  { value: "STAFF", label: "Staff" },
                ]}
              />
              <ListFilterSelect
                value={
                  branchFilter === "ALL"
                    ? "ALL"
                    : branchFilter === "hq"
                      ? "hq"
                      : String(branchFilter)
                }
                onValueChange={(value) => setValue("branch", value)}
                ariaLabel="Filter by branch"
                widthClassName="w-full sm:w-[180px]"
                options={[
                  { value: "ALL", label: "All branches" },
                  { value: "hq", label: "HQ / unassigned" },
                  ...branchList.map((branch) => ({
                    value: String(branch.id),
                    label: branch.name,
                  })),
                ]}
              />
            </>
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredUsers.length}
          totalCount={userList.length}
          itemLabel="user"
          emptyLabel="No users yet"
        />

        <OrganizationUsersTable
          users={filteredUsers}
          loading={isLoading}
          hasActiveFilters={hasActiveFilters}
          branchNameById={branchNameById}
          onEdit={handleEdit}
        />
      </HubListPage>

      <UserFormModal
        open={isModalOpen}
        onOpenChange={(next) => {
          setIsModalOpen(next);
          if (next) return;
          setEditingUser(null);
        }}
        initialValues={editingUser}
        branches={branchList}
        onSave={handleSave}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );

  if (embedded) return content;

  return (
    <RoleGuard
      allowedRoles={["SUPER_ADMIN"]}
      fallback={
        <AccessDeniedState description="Super Admin access is required to manage users and roles." />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4">{content}</div>
    </RoleGuard>
  );
}
