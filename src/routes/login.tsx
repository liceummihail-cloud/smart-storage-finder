import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const search = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
});

export const Route = createFileRoute("/login")({
  validateSearch: search,
  component: Login,
});

function Login() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        toast.success("Вітаємо!");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/rooms" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Сталась помилка");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/onboarding",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Не вдалося увійти через Google");
      setBusy(false);
      return;
    }
    if (!result.redirected) navigate({ to: "/onboarding" });
  };

  return (
    <main className="min-h-screen px-6 py-8 mx-auto max-w-md">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground text-sm mb-8">
        <ArrowLeft className="w-4 h-4" /> Назад
      </Link>

      <h1 className="text-2xl font-bold mb-2">
        {isSignup ? "Створи акаунт" : "З поверненням"}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        {isSignup ? "Кілька секунд — і починаєш" : "Раді бачити знову"}
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <NeuInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <NeuInput
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />
        <NeuButton type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? "Зачекай..." : isSignup ? "Зареєструватись" : "Увійти"}
        </NeuButton>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        або
        <div className="flex-1 h-px bg-border" />
      </div>

      <NeuButton onClick={onGoogle} size="lg" className="w-full" disabled={busy}>
        Продовжити з Google
      </NeuButton>

      <p className="text-center mt-8 text-sm text-muted-foreground">
        {isSignup ? "Вже є акаунт?" : "Ще не з нами?"}{" "}
        <Link
          to="/login"
          search={{ mode: isSignup ? "signin" : "signup" }}
          className="text-primary font-medium"
        >
          {isSignup ? "Увійти" : "Створити"}
        </Link>
      </p>
    </main>
  );
}
