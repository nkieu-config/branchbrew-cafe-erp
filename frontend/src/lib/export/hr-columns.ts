import type { CsvColumn } from "@/lib/export/csv";
import type { PayrollRun } from "@/types/hr";

type Payslip = NonNullable<PayrollRun["payslips"]>[number];

export type PayslipExportRow = Payslip & {
  runMonth: number;
  runYear: number;
  runStatus: PayrollRun["status"];
};

export function toPayslipExportRows(runs: readonly PayrollRun[]): PayslipExportRow[] {
  return runs.flatMap((run) =>
    (run.payslips ?? []).map((payslip) => ({
      ...payslip,
      runMonth: run.month,
      runYear: run.year,
      runStatus: run.status,
    })),
  );
}

export const PAYSLIP_CSV_COLUMNS: readonly CsvColumn<PayslipExportRow>[] = [
  { header: "Period", value: (row) => `${row.runYear}-${String(row.runMonth).padStart(2, "0")}` },
  { header: "Run status", value: (row) => row.runStatus },
  { header: "Employee", value: (row) => row.user?.name ?? `User #${row.userId}` },
  { header: "Standard hours", value: (row) => row.standardHours },
  { header: "OT hours", value: (row) => row.otHours },
  { header: "Base pay", value: (row) => row.basePay },
  { header: "OT pay", value: (row) => row.otPay },
  { header: "Bonuses", value: (row) => row.bonuses },
  { header: "Gross pay", value: (row) => row.grossPay },
  { header: "Tax", value: (row) => row.taxDeduction },
  { header: "Social security", value: (row) => row.socialSecurity },
  { header: "Other deductions", value: (row) => row.otherDeductions },
  { header: "Net pay", value: (row) => row.netPay },
];

export const PAYROLL_RUN_CSV_COLUMNS: readonly CsvColumn<PayrollRun>[] = [
  { header: "Period", value: (row) => `${row.year}-${String(row.month).padStart(2, "0")}` },
  { header: "Status", value: (row) => row.status },
  { header: "Branch", value: (row) => row.branch?.name ?? "All branches" },
  { header: "Payslips", value: (row) => row.payslips?.length ?? 0 },
  {
    header: "Total net pay",
    value: (row) =>
      (row.payslips ?? []).reduce((sum, payslip) => sum + payslip.netPay, 0),
  },
];
