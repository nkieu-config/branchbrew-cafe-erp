import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/shared/not-found-panel";

export const metadata: Metadata = {
  title: "Not found",
};

export default function AppNotFound() {
  return (
    <NotFoundPanel description="That record does not exist, or it belongs to a branch you cannot see. Pick another from the list, or head back to the dashboard." />
  );
}
