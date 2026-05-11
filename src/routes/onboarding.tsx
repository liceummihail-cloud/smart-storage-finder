import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, MapPin, Mic, Search, ChevronRight } from "lucide-react";
import { NeuButton, NeuCard } from "@/components/neu";
import { markTutorialDone } from "@/lib/ai.functions";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const STEPS = [
  {
    icon: Camera,
    title: "Сфотографуй кімнату",
    desc: "Зроби знімок комори, гаража або шафи — будь-якого місця, де ти зберігаєш речі.",
  },
  {
    icon: MapPin,
    title: "Познач коробки",
    desc: "Тапни на фото по кожній коробці чи ящику. З'явиться маркер з номером.",
  },
  {
    icon: Mic,
    title: "Надиктуй вміст",
    desc: "Натисни на маркер і просто скажи що там лежить. ШІ розпізнає і складе чистий список.",
  },
  {
    icon: Search,
    title: "Шукай розумно",
    desc: "Введи назву речі — навіть приблизну. ШІ знайде її, навіть якщо ти записав інакше.",
  },
];

function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const finish = useServerFn(markTutorialDone);

  const done = async () => {
    try {
      await finish();
    } catch {}
    navigate({ to: "/rooms" });
  };

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : done());

  const S = STEPS[step];
  const Icon = S.icon;

  return (
    <main className="min-h-screen px-6 py-8 mx-auto max-w-md flex flex-col">
      <div className="flex justify-between items-center mb-12">
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        <button onClick={done} className="text-xs text-muted-foreground">
          Пропустити
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
        <div className="w-32 h-32 neu-raised rounded-3xl flex items-center justify-center">
          <Icon className="w-14 h-14 text-primary" strokeWidth={1.3} />
        </div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">{S.title}</h1>
          <p className="text-muted-foreground leading-relaxed px-2">{S.desc}</p>
        </div>
      </div>

      <NeuButton variant="primary" size="lg" className="w-full mt-8" onClick={next}>
        {step < STEPS.length - 1 ? (
          <>
            Далі <ChevronRight className="w-4 h-4" />
          </>
        ) : (
          "Почати!"
        )}
      </NeuButton>
    </main>
  );
}
