"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@codex-music/api-client";
import { apiClient } from "@/lib/api-client";
import { AuthCard, AuthField, AuthSubmitButton } from "@/components/auth/auth-card";

const schema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      setFormError("Missing or invalid reset link");
      return;
    }
    setFormError(null);
    try {
      await apiClient.resetPassword(token, values.newPassword);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  };

  return (
    <AuthCard title="Set a new password">
      {done ? (
        <p className="text-center text-sm text-muted">
          Password updated. Redirecting to log in…
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <AuthField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          {formError && <p className="mb-4 text-sm text-red-400">{formError}</p>}
          <AuthSubmitButton isLoading={isSubmitting}>
            Update password
          </AuthSubmitButton>
        </form>
      )}
    </AuthCard>
  );
}

/** Same Suspense requirement as /search — see that page's comment. */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
