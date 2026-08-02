"use client";

import { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LayoutDashboard, RotateCcw, GripHorizontal } from "lucide-react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { useBranches } from "@/hooks/domains/useGeneralQueries";
import { useAuth } from "@/context/AuthContext";
import { useDashboardLayoutState } from "@/hooks/useDashboardLayoutState";
import { PageChrome } from "@/components/layout/PageChrome";
import { Button } from "@/components/ui/button";
import { dashboardCustomizeHintClass, dashboardGridClass, dashboardShellIconClassName, dashboardSkeletonClass } from "@/lib/theme/dashboard";
import type { Branch } from "@/types/api";
import {
  SalesWidget,
  TopBranchWidget,
  MarginWidget,
  LowStockWidget,
  TopProductsWidget,
} from "@/components/dashboard/widgets/SummaryWidgets";
import { OperationalTasksWidget } from "@/components/dashboard/widgets/OperationalTasksWidget";
import { SalesChartWidget } from "@/components/dashboard/widgets/SalesChartWidget";
import { WidgetErrorBoundary } from "@/components/dashboard/widgets/WidgetErrorBoundary";
import {
  StatWidgetSkeleton,
  ChartWidgetSkeleton,
  AlertsWidgetSkeleton,
} from "@/components/dashboard/widgets/WidgetSkeletons";
import { DashboardSummaryProvider } from "@/components/dashboard/DashboardSummaryContext";
import { DashboardLayoutSkeleton } from "@/components/dashboard/DashboardLayoutSkeleton";
import type { DashboardWidgetRegistry } from "@/components/dashboard/DashboardSortableGrid";

const DashboardSortableGridLazy = dynamic(
  () => import("@/components/dashboard/DashboardSortableGrid").then((m) => m.DashboardSortableGrid),
  { ssr: false },
);

function DashboardSortableGridSection({
  widgetOrder,
  onReorder,
  analyticsBranch,
  branchName,
  reset,
  customizeLayout,
}: {
  widgetOrder: string[];
  onReorder: (newOrder: string[]) => void;
  analyticsBranch: string;
  branchName: string | undefined;
  reset: () => void;
  customizeLayout: boolean;
}) {
  return (
    <DashboardGridSection
      widgetOrder={widgetOrder}
      onReorder={onReorder}
      analyticsBranch={analyticsBranch}
      branchName={branchName}
      reset={reset}
      customizeLayout={customizeLayout}
    />
  );
}

const WIDGET_SKELETONS: Record<
  string,
  { Skeleton: React.ComponentType<{ className?: string }>; className?: string }
> = {
  sales: { Skeleton: StatWidgetSkeleton },
  topBranch: { Skeleton: StatWidgetSkeleton },
  margin: { Skeleton: StatWidgetSkeleton },
  lowStock: { Skeleton: AlertsWidgetSkeleton },
  operationalTasks: { Skeleton: AlertsWidgetSkeleton },
  topProducts: { Skeleton: ChartWidgetSkeleton, className: "md:col-span-2 xl:col-span-2" },
  salesChart: { Skeleton: ChartWidgetSkeleton, className: "md:col-span-2 xl:col-span-2" },
};

/** Mirrors the real grid one-for-one so suspending never changes the page height. */
function DashboardGridFallback({ widgetOrder }: { widgetOrder: string[] }) {
  return (
    <div className={dashboardGridClass()}>
      {widgetOrder.map((id) => {
        const entry = WIDGET_SKELETONS[id];
        if (!entry) return null;
        const { Skeleton, className } = entry;
        return (
          <div key={id} className={className}>
            <Skeleton />
          </div>
        );
      })}
    </div>
  );
}

function DashboardGridSection({
  widgetOrder,
  onReorder,
  analyticsBranch,
  branchName,
  reset,
  customizeLayout,
}: {
  widgetOrder: string[];
  onReorder: (newOrder: string[]) => void;
  analyticsBranch: string;
  branchName: string | undefined;
  reset: () => void;
  customizeLayout: boolean;
}) {
  const widgets = useMemo(
    () => buildWidgetRegistry(reset, analyticsBranch, branchName),
    [reset, analyticsBranch, branchName],
  );

  if (customizeLayout) {
    return (
      <Suspense fallback={<DashboardGridFallback widgetOrder={widgetOrder} />}>
        <DashboardSummaryProvider branchId={analyticsBranch}>
          <DashboardSortableGridLazy
            widgetOrder={widgetOrder}
            onReorder={onReorder}
            widgets={widgets}
          />
        </DashboardSummaryProvider>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<DashboardGridFallback widgetOrder={widgetOrder} />}>
      <DashboardSummaryProvider branchId={analyticsBranch}>
        <DashboardStaticGrid widgetOrder={widgetOrder} widgets={widgets} />
      </DashboardSummaryProvider>
    </Suspense>
  );
}

function DashboardStaticGrid({
  widgetOrder,
  widgets,
}: {
  widgetOrder: string[];
  widgets: DashboardWidgetRegistry;
}) {
  return (
    <div className={dashboardGridClass()}>
      {widgetOrder.map((id) => {
        const widget = widgets[id];
        if (!widget) return null;
        return (
          <div key={id} className={widget.className}>
            {widget.content}
          </div>
        );
      })}
    </div>
  );
}

function WidgetBoundary({
  children,
  onReset,
}: {
  children: React.ReactNode;
  onReset: () => void;
}) {
  return <WidgetErrorBoundary onReset={onReset}>{children}</WidgetErrorBoundary>;
}

function buildWidgetRegistry(
  reset: () => void,
  analyticsBranch: string,
  branchName: string | undefined,
): DashboardWidgetRegistry {
  return {
    sales: {
      content: (
        <WidgetBoundary onReset={reset}>
          <SalesWidget branchId={analyticsBranch} />
        </WidgetBoundary>
      ),
    },
    topBranch: {
      content: (
        <WidgetBoundary onReset={reset}>
          <TopBranchWidget branchId={analyticsBranch} branchName={branchName} />
        </WidgetBoundary>
      ),
    },
    margin: {
      content: (
        <WidgetBoundary onReset={reset}>
          <Suspense fallback={<StatWidgetSkeleton />}>
            <MarginWidget branchId={analyticsBranch} />
          </Suspense>
        </WidgetBoundary>
      ),
    },
    lowStock: {
      content: (
        <WidgetBoundary onReset={reset}>
          <LowStockWidget branchId={analyticsBranch} />
        </WidgetBoundary>
      ),
    },
    operationalTasks: {
      content: (
        <WidgetBoundary onReset={reset}>
          <OperationalTasksWidget />
        </WidgetBoundary>
      ),
    },
    topProducts: {
      className: "md:col-span-2 xl:col-span-2",
      content: (
        <WidgetBoundary onReset={reset}>
          <Suspense fallback={<ChartWidgetSkeleton />}>
            <TopProductsWidget branchId={analyticsBranch} />
          </Suspense>
        </WidgetBoundary>
      ),
    },
    salesChart: {
      className: "md:col-span-2 xl:col-span-2",
      content: (
        <WidgetBoundary onReset={reset}>
          <Suspense fallback={<ChartWidgetSkeleton />}>
            <SalesChartWidget branchId={analyticsBranch} />
          </Suspense>
        </WidgetBoundary>
      ),
    },
  };
}

function AnalyticsDashboardContent() {
  const { activeBranchId, user } = useAuth();
  const analyticsBranch = activeBranchId != null ? String(activeBranchId) : "ALL";
  const {
    widgetOrder,
    layoutReady,
    isCustomLayout,
    handleReorder,
    handleResetLayout,
  } = useDashboardLayoutState();
  const [customizeLayout, setCustomizeLayout] = useState(isCustomLayout);

  const { data: branches = [] } = useBranches();

  const branchName =
    activeBranchId != null
      ? (branches as Branch[]).find((b) => b.id === activeBranchId)?.name
      : undefined;

  const dashboardDescription =
    user?.role === "SUPER_ADMIN"
      ? "Executive overview for the branch selected in the top bar."
      : "Executive overview for your branch.";

  const dashboardActions = (
    <>
      {customizeLayout ? (
        <div className={dashboardCustomizeHintClass("hidden lg:flex")}>
          <GripHorizontal className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
          <span>Drag widget handles to customize layout</span>
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden lg:inline-flex"
        onClick={() => setCustomizeLayout((prev) => !prev)}
        aria-pressed={customizeLayout}
        aria-label={customizeLayout ? "Exit dashboard layout customization" : "Customize dashboard layout"}
      >
        <GripHorizontal className="w-4 h-4 mr-2" aria-hidden />
        {customizeLayout ? "Done customizing" : "Customize layout"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleResetLayout}
        disabled={!isCustomLayout}
        aria-label="Reset dashboard widget layout to default"
      >
        <RotateCcw className="w-4 h-4 mr-2" aria-hidden />
        Reset layout
      </Button>
    </>
  );

  return (
    <div className="flex w-full flex-col">
      <PageChrome
        title="Dashboard"
        icon={LayoutDashboard}
        iconClassName={dashboardShellIconClassName()}
        description={dashboardDescription}
        actions={dashboardActions}
        branchScope={{
          branchName,
          allBranches: activeBranchId == null,
        }}
      >
        {layoutReady ? (
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <DashboardSortableGridSection
              widgetOrder={widgetOrder}
              onReorder={handleReorder}
              analyticsBranch={analyticsBranch}
              branchName={branchName}
              reset={reset}
              customizeLayout={customizeLayout}
            />
          )}
        </QueryErrorResetBoundary>
      ) : (
        <DashboardLayoutSkeleton />
      )}
      </PageChrome>
    </div>
  );
}

export default function DashboardPageClient() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className={dashboardSkeletonClass("h-20")} />
          <DashboardLayoutSkeleton />
        </div>
      }
    >
      <AnalyticsDashboardContent />
    </Suspense>
  );
}
