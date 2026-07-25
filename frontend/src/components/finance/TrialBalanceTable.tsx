"use client";

import { useMemo } from "react";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DataTable } from "@/components/shared/data-table";
import {
  ListMobileCard,
  PaginatedMobileList,
  ResponsiveDataTableLayout,
} from "@/components/shared/responsive-data-table";
import { accountTypeLabel } from "@/lib/filters/account-filters";
import { formatCurrency } from "@/lib/money";
import { hubListDataTableProps } from "@/lib/theme/data-table";
import {
  financeMutedMetaClassName,
  ledgerCreditClassName,
  ledgerDebitClassName,
} from "@/lib/theme/finance";
import { text } from "@/lib/theme/surface";
import { cn } from "@/lib/utils";
import type { TrialBalance, TrialBalanceAccount } from "@/types/accounting";

type TrialBalanceTableProps = {
  accounts: TrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  totalsLabel: string;
  isLoading: boolean;
  hasActiveFilters: boolean;
};

function balanceSide(account: TrialBalanceAccount): TrialBalance["accounts"][number]["normalBalance"] {
  if (account.balance >= 0) return account.normalBalance;
  return account.normalBalance === "DEBIT" ? "CREDIT" : "DEBIT";
}

function BalanceAmount({ account }: { account: TrialBalanceAccount }) {
  const side = balanceSide(account);
  return (
    <span className="tabular-nums">
      <span className={side === "DEBIT" ? ledgerDebitClassName() : ledgerCreditClassName()}>
        {formatCurrency(Math.abs(account.balance))}
      </span>
      <span className={cn("ml-1 text-xs", text.muted)}>{side === "DEBIT" ? "Dr" : "Cr"}</span>
    </span>
  );
}

export function TrialBalanceTable({
  accounts,
  totalDebit,
  totalCredit,
  totalsLabel,
  isLoading,
  hasActiveFilters,
}: TrialBalanceTableProps) {
  const emptyDescription = hasActiveFilters
    ? "No accounts match the current filters."
    : "No posted journal entries yet.";

  const columns = useMemo(
    () =>
      [
        {
          title: "Code",
          dataIndex: "code",
          key: "code",
          width: 100,
          render: (code: string) => (
            <span className="font-mono text-sm tabular-nums">{code}</span>
          ),
        },
        {
          title: "Account",
          dataIndex: "name",
          key: "name",
          render: (name: string) => <span className={text.secondary}>{name}</span>,
        },
        {
          title: "Type",
          dataIndex: "type",
          key: "type",
          width: 130,
          responsive: ["lg"],
          render: (type: TrialBalanceAccount["type"]) => (
            <span className={financeMutedMetaClassName()}>{accountTypeLabel(type)}</span>
          ),
        },
        {
          title: "Debit",
          dataIndex: "debit",
          key: "debit",
          width: 140,
          align: "right",
          render: (debit: number) => (
            <span className={cn("tabular-nums", debit ? ledgerDebitClassName() : text.muted)}>
              {debit ? formatCurrency(debit) : "—"}
            </span>
          ),
        },
        {
          title: "Credit",
          dataIndex: "credit",
          key: "credit",
          width: 140,
          align: "right",
          render: (credit: number) => (
            <span className={cn("tabular-nums", credit ? ledgerCreditClassName() : text.muted)}>
              {credit ? formatCurrency(credit) : "—"}
            </span>
          ),
        },
        {
          title: "Balance",
          dataIndex: "balance",
          key: "balance",
          width: 150,
          align: "right",
          render: (_balance: number, record: TrialBalanceAccount) => (
            <BalanceAmount account={record} />
          ),
        },
      ] as ColumnsType<TrialBalanceAccount>,
    [],
  );

  return (
    <ResponsiveDataTableLayout
      mobile={
        isLoading ? (
          <ResponsiveDataTableLayout.Skeleton rows={4} />
        ) : accounts.length === 0 ? (
          <ResponsiveDataTableLayout.Empty message={emptyDescription} />
        ) : (
          <>
            <PaginatedMobileList items={accounts} pageSize={0}>
              {(account) => (
                <ListMobileCard>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn("font-mono text-xs tabular-nums", text.muted)}>
                        {account.code}
                      </p>
                      <p className={cn("font-medium", text.primary)}>{account.name}</p>
                      <p className={financeMutedMetaClassName()}>
                        {accountTypeLabel(account.type)}
                      </p>
                    </div>
                    <BalanceAmount account={account} />
                  </div>
                  <dl className="flex gap-6 border-t border-[var(--table-row-border)] pt-2 text-sm">
                    <div>
                      <dt className={cn("text-xs", text.muted)}>Debit</dt>
                      <dd className={cn("tabular-nums", ledgerDebitClassName())}>
                        {account.debit ? formatCurrency(account.debit) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className={cn("text-xs", text.muted)}>Credit</dt>
                      <dd className={cn("tabular-nums", ledgerCreditClassName())}>
                        {account.credit ? formatCurrency(account.credit) : "—"}
                      </dd>
                    </div>
                  </dl>
                </ListMobileCard>
              )}
            </PaginatedMobileList>
            <div className="mt-3 flex justify-between border-t border-[var(--table-row-border)] pt-3 text-sm">
              <span className={cn("font-medium", text.primary)}>{totalsLabel}</span>
              <span className="flex gap-4">
                <span className={cn("tabular-nums", ledgerDebitClassName())}>
                  {formatCurrency(totalDebit)}
                </span>
                <span className={cn("tabular-nums", ledgerCreditClassName())}>
                  {formatCurrency(totalCredit)}
                </span>
              </span>
            </div>
          </>
        )
      }
      desktop={
        <DataTable
          {...hubListDataTableProps()}
          columns={columns}
          dataSource={accounts}
          rowKey="accountId"
          loading={isLoading}
          pagination={false}
          emptyDescription={emptyDescription}
          summary={() =>
            accounts.length === 0 ? null : (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <span className={cn("font-medium", text.primary)}>{totalsLabel}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} align="right">
                    <span className={cn("font-medium tabular-nums", ledgerDebitClassName())}>
                      {formatCurrency(totalDebit)}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <span className={cn("font-medium tabular-nums", ledgerCreditClassName())}>
                      {formatCurrency(totalCredit)}
                    </span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                </Table.Summary.Row>
              </Table.Summary>
            )
          }
        />
      }
    />
  );
}
