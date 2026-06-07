import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Check, Crown, Gift } from "lucide-react";
import { NeuButton, NeuCard } from "@/components/neu";
import { toast } from "sonner";
import {
  getMySubscription,
  startProTrial,
  createCheckoutSession,
} from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/upgrade")({
  component: Upgrade,
});

type Plan = "free" | "pro" | "yearly" | "premium";

const PLANS: {
  id: "free" | "pro" | "yearly";
  name: string;
  price: string;
  icon: typeof Sparkles;
  features: string[];
}[] = [
  {
    id: "free",
    name: "Free",
    price: "0 $",
    icon: Check,
    features: [
      "1 кімната, 1 стіна",
      "До 20 коробок на стіну",
      "До 50 предметів у коробці",
      "100 транскрипцій / міс (10/день)",
      "50 AI пошуків / міс",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "4.99 $ / міс",
    icon: Sparkles,
    features: [
      "10 кімнат, 5 стін у кімнаті",
      "До 50 коробок на стіну",
      "До 100 предметів у коробці",
      "1 000 транскрипцій / міс (50/день)",
      "5 000 AI пошуків / міс",
      "Експорт CSV/PDF",
      "Переміщення коробок між стінами",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "49.99 $ / рік",
    icon: Crown,
    features: [
      "15 кімнат, 7 стін у кімнаті",
      "До 75 коробок на стіну",
      "До 100 предметів у коробці",
      "1 500 транскрипцій / міс (75/день)",
      "7 500 AI пошуків / міс",
      "Експорт CSV/PDF",
      "Пріоритетна підтримка",
    ],
  },
];

function formatTrialLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "завершився";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `${days} ${days === 1 ? "день" : days < 5 ? "дні" : "днів"}`;
}

function Upgrade() {
  const fetchSub = useServerFn(getMySubscription);
  const startTrial = useServerFn(startProTrial);
  const checkout = useServerFn(createCheckoutSession);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialActive, setTrialActive] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);

  const refresh = async () => {
    try {
      const s = await fetchSub();
      setPlan(s.plan);
      setTrialEndsAt(s.trialEndsAt);
      setTrialActive(s.trialActive);
      setHasHistory((s.subscriptions?.length ?? 0) > 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTrial = async () => {
    setBusy(true);
    try {
      const r = await startTrial();
      if (r.ok) {
        toast.success("Pro активовано на 7 днів!");
        await refresh();
      } else if (r.reason === "already_used") {
        toast.error("Тріал вже було використано на цьому акаунті");
      } else {
        toast.error("Не вдалося активувати тріал");
      }
    } finally {
      setBusy(false);
    }
  };

  const onUpgrade = async (target: "pro" | "premium") => {
    setBusy(true);
    try {
      const r = await checkout({ data: { plan: target } });
      if (r.ok) {
        // window.location.href = r.url -- when Paddle ready
      } else {
        toast.message(r.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="px-6 py-8 mx-auto max-w-md">
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto neu-raised rounded-3xl flex items-center justify-center mb-4">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">План підписки</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Поточний: <span className="font-semibold">{plan.toUpperCase()}</span>
          {trialActive && trialEndsAt && (
            <> · тріал ще {formatTrialLeft(trialEndsAt)}</>
          )}
        </p>
      </div>

      {!loading && !hasHistory && plan === "free" && (
        <NeuCard className="mb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 neu-raised rounded-2xl flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">7 днів Pro безкоштовно</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Без карти. Можна спробувати усі функції Pro і скасувати в будь-який час.
              </p>
              <NeuButton
                variant="primary"
                className="w-full"
                onClick={onTrial}
                disabled={busy}
              >
                Активувати тріал
              </NeuButton>
            </div>
          </div>
        </NeuCard>
      )}

      <div className="space-y-4">
        {PLANS.map((p) => {
          const isCurrent = p.id === plan;
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
                    <span className="text-xs neu-pressed px-3 py-1 rounded-full">
                      {trialActive ? "тріал" : "поточний"}
                    </span>
                  ) : null}
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
                  <NeuButton
                    variant="primary"
                    className="w-full"
                    onClick={() => onUpgrade(p.id as "pro" | "yearly")}
                    disabled={busy}
                  >
                    Оформити підписку
                  </NeuButton>
                )}
              </div>
            </NeuCard>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-6">
        Web — Paddle (з ПДВ). У мобільному додатку — Google Play Billing.
      </p>
    </main>
  );
}
