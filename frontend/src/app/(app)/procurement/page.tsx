import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/server";
import { getVisibleHubTabs } from "@/lib/navigation/hub-utils";

export default async function ProcurementPage() {
  const session = await getSession();
  const [firstVisibleTab] = getVisibleHubTabs("procurement", session?.role ?? "STAFF");

  redirect(firstVisibleTab?.path ?? "/procurement/orders");
}
