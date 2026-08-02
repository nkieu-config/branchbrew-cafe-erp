"use client";

import { ReactNode } from "react";
import { CheckCircle2, Clock, Loader2, PlayCircle } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ProductionOrder, Ingredient } from "@/types/api";
import { formatDate } from "@/lib/intl-date";
import { formatCurrency } from "@/lib/money";
import {
  kanbanCardClassName,
  kanbanCompletedCardClassName,
  kanbanColumnClassName,
  kanbanColumnHeaderClassName,
  kanbanOrderBadgeClassName,
  kitchenKanbanBoardClassName,
  kitchenMutedMetaClassName,
  productionColumnTone,
} from "@/lib/theme/hub-kitchen";
import { text } from "@/lib/theme/surface";
import { StatusTone } from "@/lib/theme/status";
import { cn } from "@/lib/utils";

export type ProductionOrderWithTarget = ProductionOrder & { targetIngredient: Ingredient };

function KanbanColumn({
  id,
  title,
  icon,
  tone,
  emptyHint,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  tone: StatusTone;
  emptyHint: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <div
      ref={setNodeRef}
      className={kanbanColumnClassName(isOver, tone)}
      role="region"
      aria-label={title}
    >
      <div className={kanbanColumnHeaderClassName()}>
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{title}</span>
        </div>
      </div>
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2 min-h-[240px] sm:min-h-[360px] lg:min-h-[420px]">
        {isEmpty ? (
          <p className={cn("text-sm text-center py-8 px-2", text.muted)}>{emptyHint}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  order,
  isOverlay = false,
  isPending = false,
}: {
  order: ProductionOrderWithTarget;
  isOverlay?: boolean;
  isPending?: boolean;
}) {
  const isCompleted = order.status === "COMPLETED";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
    disabled: isCompleted || isPending,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : isPending ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        kanbanCardClassName(isOverlay),
        isCompleted && kanbanCompletedCardClassName(),
      )}
      aria-busy={isPending || undefined}
    >
      <div className="flex justify-between items-start gap-2 mb-1.5">
        <span className={kanbanOrderBadgeClassName()}>{order.orderNumber}</span>
        {isPending ? (
          <Loader2
            className="w-3.5 h-3.5 shrink-0 animate-spin motion-reduce:animate-none opacity-70"
            aria-hidden
          />
        ) : order.plannedStartDate ? (
          <span className={kitchenMutedMetaClassName("tabular-nums shrink-0")}>
            {formatDate(order.plannedStartDate)}
          </span>
        ) : null}
      </div>
      <div className={cn("font-medium truncate", text.primary)}>{order.targetIngredient?.name}</div>
      <div className={cn("text-sm tabular-nums mt-0.5", text.secondary)}>
        {order.quantityToProduce} {order.targetIngredient?.unit}
      </div>
      {isCompleted && order.actualCost != null && (
        <div className={cn("mt-2 text-xs tabular-nums", text.muted)}>
          Cost {formatCurrency(order.actualCost)}
        </div>
      )}
    </div>
  );
}

type KitchenKanbanBoardProps = {
  plannedOrders: ProductionOrderWithTarget[];
  inProgressOrders: ProductionOrderWithTarget[];
  completedOrders: ProductionOrderWithTarget[];
  activeOrder: ProductionOrderWithTarget | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  /** Order whose status write is in flight — its card locks and shows a spinner. */
  pendingOrderId?: number | null;
};

export function KitchenKanbanBoard({
  plannedOrders,
  inProgressOrders,
  completedOrders,
  activeOrder,
  onDragStart,
  onDragEnd,
  pendingOrderId = null,
}: KitchenKanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className={kitchenKanbanBoardClassName()}>
        <KanbanColumn
          id="PLANNED"
          title="Planned"
          icon={<Clock className="w-4 h-4 opacity-70" aria-hidden />}
          tone={productionColumnTone("PLANNED")}
          emptyHint="No planned orders."
        >
          {plannedOrders.map((o) => (
            <KanbanCard key={o.id} order={o} isPending={pendingOrderId === o.id} />
          ))}
        </KanbanColumn>

        <KanbanColumn
          id="IN_PROGRESS"
          title="In progress"
          icon={<PlayCircle className="w-4 h-4 opacity-70" aria-hidden />}
          tone={productionColumnTone("IN_PROGRESS")}
          emptyHint="Drag here when production starts."
        >
          {inProgressOrders.map((o) => (
            <KanbanCard key={o.id} order={o} isPending={pendingOrderId === o.id} />
          ))}
        </KanbanColumn>

        <KanbanColumn
          id="COMPLETED"
          title="Completed"
          icon={<CheckCircle2 className="w-4 h-4 opacity-70" aria-hidden />}
          tone={productionColumnTone("COMPLETED")}
          emptyHint="Finished batches appear here."
        >
          {completedOrders.map((o) => (
            <KanbanCard key={o.id} order={o} isPending={pendingOrderId === o.id} />
          ))}
        </KanbanColumn>
      </div>
      <DragOverlay>{activeOrder ? <KanbanCard order={activeOrder} isOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}
