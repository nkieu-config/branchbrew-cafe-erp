"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Coffee, Loader2 } from "lucide-react";
import { GitHubIcon } from "@/components/icons/github-icon";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { GITHUB_REPO_URL } from "@/lib/brand";
import { getErrorMessage } from "@/lib/errors";
import { resolveReturnPath } from "@/lib/auth/session-expiry";
import {
  authBrandMarkClassName,
  authBrandTaglineClassName,
  authDemoChipClassName,
  authDemoRowClassName,
  authDemoCredentialsClassName,
  authDemoCredentialsPasswordRowClassName,
  authDemoCredentialsToggleClassName,
  authDemoPanelClassName,
  authGitHubLinkClassName,
  authHeroGlowClassName,
  authHeroPanelClassName,
  authHeroPanelInnerClassName,
  authInputClassName,
  authLeftPanelClassName,
  authPageShellClassName,
  authPrimaryButtonClassName,
} from "@/lib/theme/auth";
import { AppSplash } from "@/components/shared/app-splash";
import { LoginHeroCard } from "./login-hero";
import { LoginSkeleton } from "./login-skeleton";
import { text } from "@/lib/theme/surface";
import { typeHeadingClassName } from "@/lib/theme/typography";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "password123";

type DemoAccount = {
  id: string;
  label: string;
  email: string;
  hint?: string;
};

const primaryDemoAccounts: DemoAccount[] = [
  {
    id: "manager",
    label: "Manager",
    email: "manager@branchbrew.dev",
  },
  {
    id: "admin",
    label: "Admin",
    email: "admin@branchbrew.dev",
  },
  {
    id: "staff",
    label: "Staff",
    email: "staff.downtown@branchbrew.dev",
  },
];

const riversideDemoAccount: DemoAccount = {
  id: "riverside",
  label: "Riverside Manager",
  email: "manager.riverside@branchbrew.dev",
  hint: "Alternate branch demo",
};

const allDemoAccounts: DemoAccount[] = [...primaryDemoAccounts, riversideDemoAccount];

export default function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loadingDemoId, setLoadingDemoId] = useState<string | null>(null);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const { login, isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = resolveReturnPath(searchParams.get("next"));
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      router.replace(returnPath ?? "/");
    }
  }, [isInitialized, isAuthenticated, router, returnPath]);

  const loginWithCredentials = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    setLoginError(null);
    try {
      const response = await loginApi({ email: loginEmail, password: loginPassword });
      login(response.user, returnPath);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to login");
      setLoginError(message);
      toast.error(message);
      setLoading(false);
      setLoadingDemoId(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(email, password);
  };

  const handleDemoLogin = async (account: DemoAccount) => {
    setSelectedDemoId(account.id);
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setLoadingDemoId(account.id);
    await loginWithCredentials(account.email, DEMO_PASSWORD);
  };

  const isDemoBusy = loadingDemoId !== null;

  if (!isInitialized) {
    return <LoginSkeleton />;
  }

  if (isAuthenticated) {
    return <AppSplash label="Signing you in…" />;
  }

  return (
    <div className={authPageShellClassName()}>
      <div className={authLeftPanelClassName()}>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={authGitHubLinkClassName()}
        >
          <GitHubIcon />
          GitHub
        </a>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px] pb-14"
          data-testid="login-panel"
        >
          <div className="mb-6 flex items-center gap-2.5">
            <div className={authBrandMarkClassName()}>
              <Coffee className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <span className={typeHeadingClassName("text-lg tracking-tight")}>BranchBrew</span>
              <p className={authBrandTaglineClassName()}>Multi-branch cafe ERP</p>
            </div>
          </div>

          <div className="mb-5">
            <h1
              className={typeHeadingClassName("text-2xl tracking-tight mb-1")}
              data-testid="login-heading"
            >
              Sign in
            </h1>
            <p className={cn("text-sm", text.muted)}>Use your work email and password, or start with a demo account.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={text.secondary}>Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@branchbrew.dev"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedDemoId(null);
                }}
                autoComplete="username"
                required
                className={authInputClassName()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className={text.secondary}>Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSelectedDemoId(null);
                }}
                autoComplete="current-password"
                required
                className={authInputClassName()}
              />
            </div>

            <div role="alert" aria-live="polite">
              {loginError ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {loginError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className={authPrimaryButtonClassName("gap-2")}
              disabled={loading || isDemoBusy}
              aria-busy={loading || undefined}
              data-testid="login-submit"
            >
              {loading && !loadingDemoId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className={authDemoPanelClassName()} data-testid="login-demo-panel">
            <p className={cn("mb-2.5 text-xs text-center", text.muted)}>Demo accounts</p>
            <div className="space-y-2">
              <div className="flex gap-2" role="group" aria-label="Primary demo accounts">
                {primaryDemoAccounts.map((account) => {
                  const isActive = selectedDemoId === account.id;
                  const isLoading = loadingDemoId === account.id;

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleDemoLogin(account)}
                      disabled={loading || isDemoBusy}
                      className={authDemoChipClassName(isActive)}
                      aria-label={`Sign in as demo ${account.label}`}
                      data-testid={`demo-login-${account.id}`}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        account.label
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleDemoLogin(riversideDemoAccount)}
                disabled={loading || isDemoBusy}
                className={authDemoRowClassName(selectedDemoId === riversideDemoAccount.id)}
                aria-label={`Sign in as demo ${riversideDemoAccount.label}`}
              >
                {loadingDemoId === riversideDemoAccount.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <span>{riversideDemoAccount.label}</span>
                    <span className={cn("hidden font-normal sm:inline", text.muted)}>
                      {riversideDemoAccount.hint}
                    </span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCredentials((open) => !open)}
              className={authDemoCredentialsToggleClassName()}
              aria-expanded={showCredentials}
              aria-controls="demo-credentials"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform motion-reduce:transition-none",
                  showCredentials && "rotate-180",
                )}
                aria-hidden
              />
              {showCredentials ? "Hide demo logins" : "Show demo logins"}
            </button>

            {showCredentials ? (
              <div id="demo-credentials" className={authDemoCredentialsClassName()}>
                {allDemoAccounts.map((account) => (
                  <p key={account.email} className="flex justify-between gap-2">
                    <span>{account.label}</span>
                    <span className={cn("text-right break-all", text.primary)}>{account.email}</span>
                  </p>
                ))}
                <p className={authDemoCredentialsPasswordRowClassName()}>
                  <span>Password</span>
                  <span className={text.primary}>{DEMO_PASSWORD}</span>
                </p>
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>

      <div className={authHeroPanelClassName()} data-testid="login-hero">
        <div className={authHeroGlowClassName("top-[-10%] left-[-10%] w-[50%] h-[50%]")} />
        <div className={authHeroGlowClassName("bottom-[-10%] right-[-10%] w-[60%] h-[60%] blur-[130px]")} />

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className={authHeroPanelInnerClassName()}
        >
          <LoginHeroCard />
        </motion.div>
      </div>
    </div>
  );
}
