import type { Metadata } from "next";
import { NotFoundPanel } from "@/components/shared/not-found-panel";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function GlobalNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <NotFoundPanel />
    </main>
  );
}
