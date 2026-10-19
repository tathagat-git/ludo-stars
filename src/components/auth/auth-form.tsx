"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/* ------------------------------ Schemas ------------------------------ */

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type LoginValues = z.infer<typeof loginSchema>;

const registerSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(
        /^[A-Za-z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      ),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });
type RegisterValues = z.infer<typeof registerSchema>;

/* ------------------------------ Component ------------------------------ */

export interface AuthFormProps {
  /** Optional callback fired after a successful login or registration. */
  onAuthed?: () => void;
  /** Controlled tab value. Defaults to internal state. */
  defaultTab?: "login" | "register";
  className?: string;
}

export function AuthForm({
  onAuthed,
  defaultTab = "login",
  className,
}: AuthFormProps) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-2xl">Ludo Stars</CardTitle>
        <CardDescription>
          Sign in to play with friends, or create a new account to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "login" | "register")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <LoginForm onAuthed={onAuthed} />
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <RegisterForm
              onAuthed={onAuthed}
              onRegisterSuccess={() => setTab("login")}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Login ------------------------------ */

function LoginForm({ onAuthed }: { onAuthed?: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        redirect: false,
      });
      if (!res || res.error) {
        toast.error("Invalid email or password");
        return;
      }
      toast.success("Welcome back!");
      router.refresh();
      onAuthed?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={submitting}
          {...registerField("email")}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
          disabled={submitting}
          {...registerField("password")}
        />
      </Field>

      <Button type="submit" disabled={submitting} className="mt-2 w-full">
        {submitting && <Loader2 className="animate-spin" />}
        {submitting ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}

/* ------------------------------ Register ------------------------------ */

function RegisterForm({
  onAuthed,
  onRegisterSuccess,
}: {
  onAuthed?: () => void;
  onRegisterSuccess: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", username: "", password: "" },
  });

  const onSubmit = async (values: RegisterValues) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          username: values.username.trim(),
          password: values.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error ?? "Could not create account");
        return;
      }

      // Auto-login after successful registration
      const sign = await signIn("credentials", {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        redirect: false,
      });
      if (!sign || sign.error) {
        // Account was created but auto-login failed — switch to login tab.
        toast.success("Account created. Please sign in.");
        onRegisterSuccess();
        return;
      }
      toast.success("Welcome to Ludo Stars!");
      router.refresh();
      onAuthed?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={submitting}
          {...registerField("email")}
        />
      </Field>

      <Field label="Username" error={errors.username?.message}>
        <Input
          type="text"
          autoComplete="username"
          placeholder="dice_master"
          disabled={submitting}
          {...registerField("username")}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          disabled={submitting}
          {...registerField("password")}
        />
      </Field>

      <Button type="submit" disabled={submitting} className="mt-2 w-full">
        {submitting && <Loader2 className="animate-spin" />}
        {submitting ? "Creating account…" : "Create Account"}
      </Button>
    </form>
  );
}

/* ------------------------------ Helper ------------------------------ */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : null}
    </div>
  );
}

export default AuthForm;
