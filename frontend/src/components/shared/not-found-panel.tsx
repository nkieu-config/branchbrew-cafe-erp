import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { hubPrimaryActionClassName } from "@/lib/theme/stock";
import { statusToneClassName } from "@/lib/theme/status";
import { text } from "@/lib/theme/surface";
import { typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";

type NotFoundPanelProps = {
  title?: string;
  description?: string;
  homeLabel?: string;
  className?: string;
};

export function NotFoundPanel({
  title = "Page not found",
  description = "That link does not point anywhere in BranchBrew. It may have been moved or the record may no longer exist.",
  homeLabel = "Go to Dashboard",
  className,
}: NotFoundPanelProps) {
  return (
    <div
      className={cn(
        "flex min-h-[min(60dvh,26rem)] flex-col items-center justify-center gap-4 p-6 text-center",
        className,
      )}
      data-testid="not-found-panel"
    >
      <div className={cn("rounded-full p-4", statusToneClassName("neutral"))}>
        <Compass className="h-10 w-10" aria-hidden />
      </div>
      <h1 className={typeHeadingClassName("text-xl")}>{title}</h1>
      <p className={cn("max-w-md text-sm", text.muted)}>{description}</p>
      <ButtonLink href="/" className={hubPrimaryActionClassName()}>
        {homeLabel}
      </ButtonLink>
    </div>
  );
}
