import { Gift, Users, TicketPercent } from "lucide-react";
import type { HubConfig } from "../types";

export const crmHub: HubConfig = {
  id: "crm",
  label: "CRM",
  description: "Manage customer loyalty and marketing campaigns.",
  icon: Gift,
  basePath: "/crm",
  wrapAntd: false,
  tabs: [
    {
      id: "customers",
      label: "Customers & Loyalty",
      path: "/crm/customers",
      icon: Users,
      roles: ["SUPER_ADMIN", "MANAGER"],
    },
    {
      id: "promotions",
      label: "Campaigns",
      path: "/crm/promotions",
      icon: TicketPercent,
      roles: ["SUPER_ADMIN", "MANAGER"],
    },
  ],
};
