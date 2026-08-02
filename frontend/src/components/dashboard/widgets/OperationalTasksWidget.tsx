"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidgetHeader } from "@/components/dashboard/DashboardWidgetHeader";
import { useAuth } from "@/context/AuthContext";
import { useNavCounts } from "@/hooks/useNavCounts";
import {
  buildOperationalTasks,
  operationalTaskTone,
} from "@/lib/nav-counts";
import {
  dashboardAlertCountBadgeClass,
  dashboardAlertsEmptyClass,
  dashboardAlertsEmptyIconClassName,
  dashboardAlertsEmptyTextClassName,
  dashboardAlertsRowClass,
  dashboardWidgetCardClass,
} from "@/lib/theme/dashboard";
import { text } from "@/lib/theme/surface";
import { typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";

export function OperationalTasksWidget() {
  const { user } = useAuth();
  const { data: counts, isPending } = useNavCounts(true);

  const tasks = useMemo(
    () => (counts ? buildOperationalTasks(counts, user?.role) : []),
    [counts, user?.role],
  );

  const taskCount = tasks.reduce((sum, task) => sum + task.count, 0);
  const isLoading = isPending || !counts;

  return (
    <Card className={dashboardWidgetCardClass("alerts", "h-[240px] xl:h-full overflow-hidden flex flex-col")}>
      <DashboardWidgetHeader
        variant="alerts"
        icon={ClipboardList}
        title="Operational Tasks"
        description={
          isLoading
            ? "Checking operational queues…"
            : taskCount > 0
              ? "Items needing follow-up outside inventory"
              : "No pending operational tasks"
        }
        badge={
          isLoading ? (
            <Skeleton className="h-5 w-16 rounded-full" />
          ) : taskCount > 0 ? (
            <span className={dashboardAlertCountBadgeClass("low")}>{taskCount} open</span>
          ) : (
            <span className={dashboardAlertCountBadgeClass("neutral")}>Clear</span>
          )
        }
      />
      <CardContent className="p-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3" role="status" aria-live="polite">
            <span className="sr-only">Loading operational tasks</span>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : tasks.length > 0 ? (
          <div className="divide-y divide-[var(--widget-alerts-divider)]">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className={dashboardAlertsRowClass(
                  operationalTaskTone(task.count) === "danger" ? "expiry" : "low",
                )}
              >
                <div className="min-w-0">
                  <div className={typeHeadingClassName("text-base")}>{task.label}</div>
                  <div className={cn("text-sm font-medium", text.muted)}>Open in module</div>
                </div>
                <span className={dashboardAlertCountBadgeClass("low")}>{task.count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={dashboardAlertsEmptyClass()}>
            <CheckCircle2
              className={dashboardAlertsEmptyIconClassName("w-10 h-10 mb-2")}
              aria-hidden
            />
            <span className={dashboardAlertsEmptyTextClassName()}>
              Operational queues are clear.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
