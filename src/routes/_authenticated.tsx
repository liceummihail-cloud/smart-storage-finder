import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { Boxes, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { mode: "signin" } });

    // Check tutorial flag
    const { data: profile } = await supabase
      .from("profiles")
      .select("tutorial_completed")
      .eq("user_id", data.session.user.id)
      .maybeSingle();
    if (profile && !profile.tutorial_completed && !location.pathname.startsWith("/onboarding")) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const loc = useLocation();
  const tabs = [
    { to: "/rooms", icon: Boxes, label: "Кімнати" },
    { to: "/search", icon: Search, label: "Пошук" },
    { to: "/upgrade", icon: Sparkles, label: "Pro" },
  ] as const;

  return (
    <div className="min-h-screen pb-28">
      <Outlet />
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="neu-raised flex gap-1 p-2 rounded-3xl">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-2xl transition-all ${
                  active ? "neu-pressed text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={1.7} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
