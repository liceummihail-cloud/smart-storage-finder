import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Check } from "lucide-react";
import { NeuButton, NeuCard } from "@/components/neu";

export const Route = createFileRoute("/_authenticated/upgrade")({
  component: Upgrade,
});

function Upgrade() {
  return (
    <main className="px-6 py-8 mx-auto max-w-md">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto neu-raised rounded-3xl flex items-center justify-center mb-4">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">План підписки</h1>
      </div>

      <NeuCard className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Free</h2>
          <span className="text-xs neu-pressed px-3 py-1 rounded-full">поточний</span>
        </div>
        <ul className="space-y-2 text-sm">
          {["До 3 кімнат", "До 30 коробок", "100 голосових записів / міс", "200 пошуків / міс"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-accent" /> {f}
            </li>
          ))}
        </ul>
      </NeuCard>

      <NeuCard className="bg-gradient-to-br from-background to-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 gradient-primary pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Pro
            </h2>
            <span className="text-xs neu-pressed px-3 py-1 rounded-full">скоро</span>
          </div>
          <ul className="space-y-2 text-sm mb-5">
            {[
              "Необмежено кімнат і коробок",
              "Необмежено голосу і пошуків",
              "Шарінг з родиною",
              "Експорт списків",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" /> {f}
              </li>
            ))}
          </ul>
          <NeuButton variant="primary" className="w-full" disabled>
            Сповістити мене
          </NeuButton>
        </div>
      </NeuCard>
    </main>
  );
}
