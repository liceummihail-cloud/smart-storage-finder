import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Boxes, Mic, Search, Camera } from "lucide-react";
import { NeuButton, NeuCard } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/rooms" });
  },
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen px-6 py-12 mx-auto max-w-md flex flex-col">
      <div className="flex-1 flex flex-col justify-center gap-10">
        <header className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 neu-raised flex items-center justify-center rounded-3xl">
            <Boxes className="w-10 h-10 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold leading-tight">
            Storage <span className="text-primary">Organiser</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed px-4">
            Більше ніколи не загубиш свої речі. Сфотографуй, надиктуй, знайди.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Camera, label: "Фото" },
            { icon: Mic, label: "Голос" },
            { icon: Search, label: "ШІ-пошук" },
          ].map(({ icon: Icon, label }) => (
            <NeuCard key={label} className="!p-4 flex flex-col items-center gap-2">
              <Icon className="w-6 h-6 text-accent" strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </NeuCard>
          ))}
        </div>

        <div className="space-y-3">
          <Link to="/login" search={{ mode: "signup" }} className="block">
            <NeuButton variant="primary" size="lg" className="w-full">
              Створити акаунт
            </NeuButton>
          </Link>
          <Link to="/login" search={{ mode: "signin" }} className="block">
            <NeuButton size="lg" className="w-full">
              Увійти
            </NeuButton>
          </Link>
        </div>
      </div>
    </main>
  );
}
