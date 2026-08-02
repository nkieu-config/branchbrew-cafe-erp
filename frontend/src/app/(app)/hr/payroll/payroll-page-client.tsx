"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { HubListPage } from "@/components/shared/hub-list-page";
import { ListFilterSelect } from "@/components/shared/list-filters";
import { BranchEmptyState } from "@/components/shared/branch-empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PayrollRunsTable } from "@/components/hr/PayrollRunsTable";
import {
  useApprovePayrollRun,
  useGeneratePayrollRun,
  useHrUsers,
  usePayrollRuns,
} from "@/hooks/domains/useHrQueries";
import { buildHrPayrollUrl } from "@/lib/hr-hub-url";
import { formatCurrency } from "@/lib/money";
import { getErrorMessage } from "@/lib/errors";
import {
  type PayrollRunWithPayslips,
  type PayrollStatusFilter,
  filterPayrollRuns,
  formatPayrollPeriod,
  hasPayrollRunForMonth,
  payrollRunTotalNet,
  summarizePayrollRuns,
} from "@/lib/filters/payroll-filters";
import { ExportCsvButton } from "@/components/shared/export-csv-button";
import { PAYSLIP_CSV_COLUMNS, toPayslipExportRows } from "@/lib/export/hr-columns";
import { infoBannerClassName, infoBannerTextClassName } from "@/lib/theme/hub-banners";
import { hubCtaClassName, inlineLinkClassName } from "@/lib/theme/hub-primitives";
import { hrSectionPanelClassName } from "@/lib/theme/hub-hr";
import { cn } from "@/lib/utils";
import type { User } from "@/types/api";

export default function PayrollPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchId } = useAuth();
  const branchIdNum = activeBranchId ? Number(activeBranchId) : undefined;

  const payrollEmployeeParam = searchParams.get("employee");
  const employeeId = useMemo(() => {
    if (!payrollEmployeeParam) return null;
    const id = Number(payrollEmployeeParam);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [payrollEmployeeParam]);

  const { data: hrUsers = [] } = useHrUsers(branchIdNum);

  const {
    data: payrollRuns = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = usePayrollRuns(branchIdNum);

  const generatePayrollMutation = useGeneratePayrollRun();
  const approvePayrollMutation = useApprovePayrollRun();

  const [statusFilter, setStatusFilter] = useState<PayrollStatusFilter>("ALL");
  const [approveTarget, setApproveTarget] = useState<PayrollRunWithPayslips | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentPeriodLabel = formatPayrollPeriod(currentMonth, currentYear);

  const filteredEmployee = employeeId != null
    ? (hrUsers as User[]).find((employee) => employee.id === employeeId)
    : undefined;

  const summary = useMemo(
    () => summarizePayrollRuns(payrollRuns as PayrollRunWithPayslips[]),
    [payrollRuns],
  );

  const filteredPayrollRuns = useMemo(
    () =>
      filterPayrollRuns(payrollRuns as PayrollRunWithPayslips[], {
        statusFilter,
        employeeId,
      }),
    [payrollRuns, statusFilter, employeeId],
  );

  const defaultExpandedRowKeys = useMemo(() => {
    if (employeeId == null) return undefined;
    return filteredPayrollRuns.map((run) => run.id);
  }, [employeeId, filteredPayrollRuns]);

  const hasCurrentMonthRun = hasPayrollRunForMonth(
    payrollRuns as PayrollRunWithPayslips[],
    currentMonth,
    currentYear,
  );

  const hasActiveFilters = statusFilter !== "ALL" || employeeId != null;

  const clearEmployeeFilter = () => {
    router.replace(buildHrPayrollUrl(), { scroll: false });
  };

  const handleGenerate = async () => {
    if (!branchIdNum) return;
    try {
      await generatePayrollMutation.mutateAsync({
        branchId: branchIdNum,
        month: currentMonth,
        year: currentYear,
      });
      toast.success(`Payroll generated for ${currentPeriodLabel}`);
      setShowGenerateConfirm(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to generate payroll"));
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approvePayrollMutation.mutateAsync(id);
      toast.success("Payroll run approved");
      setApproveTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to approve payroll"));
    }
  };

  if (!activeBranchId) {
    return (
      <BranchEmptyState description="Select a branch in the top bar to generate and manage payroll." />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          className={hubCtaClassName("hr")}
          disabled={hasCurrentMonthRun || generatePayrollMutation.isPending}
          onClick={() => setShowGenerateConfirm(true)}
        >
          {generatePayrollMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none" aria-hidden />
              Generating…
            </>
          ) : (
            <>Generate {currentPeriodLabel}</>
          )}
        </Button>
      </div>

      <HubListPage className={hrSectionPanelClassName()}>
        {employeeId != null && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3 flex flex-wrap items-center justify-between gap-2")}>
              <p className={infoBannerTextClassName()}>
                Filtered to {filteredEmployee?.name ?? `employee #${employeeId}`}
              </p>
              <button
                type="button"
                className={cn("text-sm", inlineLinkClassName())}
                onClick={clearEmployeeFilter}
              >
                Clear
              </button>
            </div>
          </HubListPage.Banner>
        )}

        {summary.draft > 0 && (
          <HubListPage.Banner>
            <div className={infoBannerClassName("py-3")}>
              <p className={infoBannerTextClassName()}>
                {summary.draft} draft run{summary.draft === 1 ? "" : "s"} awaiting approval
              </p>
            </div>
          </HubListPage.Banner>
        )}

        <HubListPage.Error
          message={isError ? getErrorMessage(error, "Failed to load payroll runs") : undefined}
          onRetry={() => void refetch()}
          loading={isFetching}
        />

        <HubListPage.Toolbar
          showReset={hasActiveFilters}
          onReset={() => {
            setStatusFilter("ALL");
            clearEmployeeFilter();
          }}
          freshness={{ dataUpdatedAt, isFetching, onRefresh: () => void refetch() }}
          actions={
            <ExportCsvButton
              filenameBase="payslips"
              label="Export payslips"
              rows={toPayslipExportRows(filteredPayrollRuns)}
              columns={PAYSLIP_CSV_COLUMNS}
            />
          }
          filters={
            <ListFilterSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as PayrollStatusFilter)}
              ariaLabel="Filter payroll runs by status"
              widthClassName="w-full sm:w-[180px]"
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "DRAFT", label: "Draft" },
                { value: "APPROVED", label: "Approved" },
                { value: "PAID", label: "Paid" },
              ]}
            />
          }
        />

        <HubListPage.Count
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredPayrollRuns.length}
          totalCount={payrollRuns.length}
          itemLabel="run"
        />

        <PayrollRunsTable
          payrollRuns={filteredPayrollRuns}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          hasCurrentMonthRun={hasCurrentMonthRun}
          currentPeriodLabel={currentPeriodLabel}
          employeeId={employeeId}
          employeeName={filteredEmployee?.name}
          defaultExpandedRowKeys={defaultExpandedRowKeys}
          onApprove={setApproveTarget}
        />
      </HubListPage>

      <ConfirmDialog
        open={showGenerateConfirm}
        onOpenChange={setShowGenerateConfirm}
        title={`Generate ${currentPeriodLabel}?`}
        description="Creates a draft run from attendance hours."
        confirmLabel="Generate"
        loading={generatePayrollMutation.isPending}
        onConfirm={handleGenerate}
      />

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => !open && setApproveTarget(null)}
        title="Approve payroll run?"
        description={
          approveTarget
            ? `${formatPayrollPeriod(approveTarget.month, approveTarget.year)} · ${formatCurrency(payrollRunTotalNet(approveTarget))} net`
            : undefined
        }
        confirmLabel="Approve"
        loading={approvePayrollMutation.isPending}
        onConfirm={async () => {
          if (approveTarget) await handleApprove(approveTarget.id);
        }}
      />
    </>
  );
}
