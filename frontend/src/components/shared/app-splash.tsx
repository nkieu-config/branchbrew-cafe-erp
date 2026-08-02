import { Coffee, Loader2 } from "lucide-react";
import { authBrandMarkClassName } from "@/lib/theme/auth";
import { text } from "@/lib/theme/surface";
import { typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";

type AppSplashProps = {
  label?: string;
  className?: string;
};

/** Full-screen branded loading state — use whenever the whole viewport would otherwise be blank. */
export function AppSplash({ label = "Loading BranchBrew", className }: AppSplashProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen w-full flex-1 flex-col items-center justify-center gap-4 bg-background",
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid="app-splash"
    >
      <div className="flex items-center gap-2.5">
        <div className={authBrandMarkClassName()}>
          <Coffee className="h-4 w-4" aria-hidden />
        </div>
        <span className={typeHeadingClassName("text-lg tracking-tight")}>BranchBrew</span>
      </div>
      <Loader2
        className={cn("h-5 w-5 animate-spin motion-reduce:animate-none", text.muted)}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
