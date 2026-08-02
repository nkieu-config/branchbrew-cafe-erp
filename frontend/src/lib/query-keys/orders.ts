export type OrderListWindow = {
  limit: number;
  offset: number;
  status?: string;
  search?: string;
  since?: string;
};

export const orderKeys = {
  root: ["orders"] as const,
  branch: (branchId?: number) => ["orders", branchId] as const,
  branchList: (branchId: number | undefined, window: OrderListWindow) =>
    ["orders", branchId, window] as const,
  products: ["products"] as const,
};
