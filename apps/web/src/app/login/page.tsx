"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@melune/api-client";
import { loginSchema, LoginFormValues } from "@/lib/auth-schemas";
import { apiClient } from "@/lib/api-client";
import { safeRedirect } from "@/lib/nav";
import { useAuthStore } from "@/store/auth-store";
import { AuthCard, AuthField, AuthSubmitButton } from "@/components/auth/auth-card";

/** Seeded account from the demo dataset (see README). */
const DEMO_EMAIL = "demo@melune.app";
const DEMO_PASSWORD = "melune12345";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      const { user, accessToken } = await apiClient.login(values);
      setSession(user, accessToken);
      router.push(safeRedirect(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  };

  /** Demo builds ship with a seeded account — let reviewers skip typing. */
  const quickDemoLogin = () => {
    setValue("email", DEMO_EMAIL);
    setValue("password", DEMO_PASSWORD);
    void onSubmit({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to keep the music going"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <div className="mb-4 text-right text-sm">
          <Link href="/forgot-password" className="text-muted hover:text-primary">
            Forgot password?
          </Link>
        </div>
        {formError && <p className="mb-4 text-sm text-red-400">{formError}</p>}
        <AuthSubmitButton isLoading={isSubmitting}>Log in</AuthSubmitButton>
        <p className="mt-4 rounded-xl border border-border/60 bg-surfaceElevated/60 px-3 py-2 text-center text-xs text-muted">
          Demo account: <span className="text-foreground/85">{DEMO_EMAIL}</span>
          <span className="mx-1 opacity-50">/</span>
          <span className="text-foreground/85">{DEMO_PASSWORD}</span>
        </p>
        <button
          type="button"
          onClick={quickDemoLogin}
          disabled={isSubmitting}
          className="mt-3 w-full rounded-xl border border-border bg-surfaceElevated/40 py-2 text-sm text-foreground/85 transition hover:border-primary/60 hover:text-foreground disabled:opacity-60"
        >
          Quick demo login
        </button>
      </form>
    </AuthCard>
  );
}
