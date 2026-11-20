"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@melune/api-client";
import { registerSchema, RegisterFormValues } from "@/lib/auth-schemas";
import { apiClient } from "@/lib/api-client";
import { safeRedirect } from "@/lib/nav";
import { useAuthStore } from "@/store/auth-store";
import { AuthCard, AuthField, AuthSubmitButton } from "@/components/auth/auth-card";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    try {
      const { user, accessToken } = await apiClient.register(values);
      setSession(user, accessToken);
      // New accounts go through the genre picker once (see
      // app/onboarding/page.tsx) before landing on their actual
      // destination — it forwards `next` itself once that's done.
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(`/onboarding?next=${encodeURIComponent(safeRedirect(next))}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Your music, smarter, starts here"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
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
          label="Username"
          type="text"
          autoComplete="username"
          error={errors.username?.message}
          {...register("username")}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <AuthField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        {formError && <p className="mb-4 text-sm text-red-400">{formError}</p>}
        <AuthSubmitButton isLoading={isSubmitting}>Create account</AuthSubmitButton>
      </form>
    </AuthCard>
  );
}
