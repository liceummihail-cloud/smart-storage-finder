import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { searchItems } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

type Match = {
  id: string;
  name: string;
  container_id: string;
  container_label: string;
  room_id: string;
  room_name: string;
  similarity: number;
};

function SearchPage() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const search = useServerFn(searchItems);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await search({ data: { query: q.trim() } });
      setMatches(res.matches as Match[]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="px-6 py-8 mx-auto max-w-md">
      <h1 className="text-2xl font-bold mb-2">Розумний пошук</h1>
      <p className="text-xs text-muted-foreground mb-6">
        ШІ знайде річ, навіть якщо ти записав її іншою назвою
      </p>

      <form onSubmit={onSearch} className="flex gap-2 mb-6">
        <NeuInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Що шукаєш?..."
          autoFocus
        />
        <NeuButton variant="primary" type="submit" size="icon" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
        </NeuButton>
      </form>

      <div className="space-y-3">
        {matches.map((m) => (
          <Link key={m.id} to="/rooms/$roomId" params={{ roomId: m.room_id }}>
            <NeuCard className="!p-4">
              <div className="font-semibold">{m.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {m.room_name} → коробка {m.container_label}
              </div>
              <div className="text-[10px] text-primary mt-1">
                відповідність: {(m.similarity * 100).toFixed(0)}%
              </div>
            </NeuCard>
          </Link>
        ))}
        {!busy && matches.length === 0 && q && (
          <p className="text-center text-sm text-muted-foreground py-8">Нічого не знайдено</p>
        )}
      </div>
    </main>
  );
}
