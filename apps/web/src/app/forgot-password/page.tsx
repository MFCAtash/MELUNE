"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  ForgotPasswordFormValues,
} from "@/lib/auth-schemas";
import { apiClient } from "@/lib/api-client";
import { AuthCard, AuthField, AuthSubmitButton } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    // The API always resolves silently here regardless of whether the
    // email is registered, so the UI can't and shouldn't distinguish
    // "sent" from "not found" either — that would leak account existence.
    await apiClient.forgotPassword(values.email).catch(() => undefined);
    setSubmitted(true);
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to get back in"
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {submitted ? (
        <p className="text-center text-sm text-muted">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <AuthSubmitButton isLoading={isSubmitting}>
            Send reset link
          </AuthSubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
