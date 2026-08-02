"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  buildLoginUrlWithReturnPath,
  onSessionExpired,
  resetSessionExpiredNotice,
} from "@/lib/auth/session-expiry";

export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => onSessionExpired(() => setOpen(true)), []);

  const handleSignIn = () => {
    const query = searchParams.toString();
    resetSessionExpiredNotice();
    setOpen(false);
    router.push(buildLoginUrlWithReturnPath(pathname, query ? `?${query}` : ""));
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        data-testid="session-expired-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-accent" aria-hidden />
            Your session has expired
          </DialogTitle>
          <DialogDescription>
            You have been signed out for security. Sign in again and we will bring you
            straight back to this page — anything you have typed here stays put.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={handleSignIn}>
            Sign in again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
