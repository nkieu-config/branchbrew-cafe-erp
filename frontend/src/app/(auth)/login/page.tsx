"use client";

import dynamic from "next/dynamic";
import { LoginSkeleton } from "./login-skeleton";

const LoginContent = dynamic(() => import("./login-content"), {
  ssr: false,
  loading: () => <LoginSkeleton />,
});

export default function LoginPage() {
  return <LoginContent />;
}
