import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Check, Crown } from "lucide-react";
import { NeuButton, NeuCard } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/upgrade")({
  component: Upgrade,
});

type Plan = "free" | "pro" | "premium";

const PLANS: {
  id: Plan;
  name: string;
  price: string;
  icon: typeof Sparkles;
  features: string[];
}[] = [
  {
    id: "free",
    name: "Free",
    price: "0 ₴",
    icon: Check,
    features: [
      "1 кімната",
      "До 30 коробок",
      "Без поділу на стіни",
      "100 голосових / міс",
      "200 пошуків / міс",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "79 ₴ / міс",
    icon: Sparkles,
    features: [
      "До 10 кімнат",
      "До 10 стін у кімнаті",
      "Необмежено коробок",
      "Необмежено голосу і пошуків",
      "PIN-код та біометрія",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "199 ₴ / міс",
    icon: Crown,
    features: [
      "Усе з Pro",
      "Без обмежень кімнат і стін",
      "Шарінг з родиною",
      "Експорт списків",
      "Пріоритетна підтримка",
    ],
  },
];

function Upgrade() {
  const [current, setCurrent] = useState<Plan>("free");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data?.plan) setCurrent(data.plan as Plan);
    })();
  }, []);

  return (
    <main className="px-6 py-8 mx-auto max-w-md">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto neu-raised rounded-3xl flex items-center justify-center mb-4">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">План підписки</h1>
        <p className="text-xs text-muted-foreground mt-1">Поточний: {current.toUpperCase()}</p>
      </div>

      <div className="space-y-4">
        {PLANS.map((p) => {
          const isCurrent = p.id === current;
          const Icon = p.icon;
          return (
            <NeuCard key={p.id} className="relative overflow-hidden">
              {p.id !== "free" && (
                <div className="absolute inset-0 opacity-10 gradient-primary pointer-events-none" />
              )}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" /> {p.name}
                  </h2>
                  {isCurrent ? (
                    <span className="text-xs neu-pressed px-3 py-1 rounded-full">поточний</span>
                  ) : (
                    <span className="text-xs neu-pressed px-3 py-1 rounded-full">скоро</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{p.price}</p>
                <ul className="space-y-2 text-sm mb-5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-accent" /> {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && p.id !== "free" && (
                  <NeuButton variant="primary" className="w-full" disabled>
                    Сповістити мене
                  </NeuButton>
                )}
              </div>
            </NeuCard>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-6">
        Платежі додамо незабаром. У мобільному додатку — через Google Play Billing.
      </p>
    </main>
  );
}
