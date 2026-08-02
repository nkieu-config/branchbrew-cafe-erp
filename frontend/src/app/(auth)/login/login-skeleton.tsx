import { Coffee } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  authBrandMarkClassName,
  authDemoPanelClassName,
  authHeroPanelClassName,
  authLeftPanelClassName,
  authPageShellClassName,
} from "@/lib/theme/auth";

export function LoginSkeleton() {
  return (
    <div
      className={authPageShellClassName()}
      role="status"
      aria-live="polite"
      data-testid="login-skeleton"
    >
      <span className="sr-only">Loading sign-in</span>

      <div className={authLeftPanelClassName()}>
        <div className="w-full max-w-[400px] pb-14">
          <div className="mb-6 flex items-center gap-2.5">
            <div className={authBrandMarkClassName()}>
              <Coffee className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>

          <div className="mb-5 space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-full" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>

          <div className={authDemoPanelClassName()}>
            <Skeleton className="mx-auto h-3 w-24" />
            <div className="mt-2.5 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-11 flex-1" />
                <Skeleton className="h-11 flex-1" />
                <Skeleton className="h-11 flex-1" />
              </div>
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className={authHeroPanelClassName()} aria-hidden />
    </div>
  );
}
