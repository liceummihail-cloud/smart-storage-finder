import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, LogOut, ImagePlus, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";
import { signOut } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/rooms")({
  component: Rooms,
});

const FREE_ROOMS_LIMIT = 1;
type Room = { id: string; name: string; photo_url: string | null };
type Plan = "free" | "pro" | "yearly" | "premium";

function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [plan, setPlan] = useState<Plan>("free");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: rs }, { data: prof }] = await Promise.all([
      supabase.from("rooms").select("id,name,photo_url").order("created_at", { ascending: false }),
      supabase.from("profiles").select("plan").eq("user_id", u.user.id).maybeSingle(),
    ]);
    setRooms(rs ?? []);
    setPlan((prof?.plan as Plan) ?? "free");
  };

  useEffect(() => {
    load();
  }, []);

  const atLimit = plan === "free" && rooms.length >= FREE_ROOMS_LIMIT;

  const create = async () => {
    if (!name.trim() || !file) {
      toast.error("Додай назву та фото");
      return;
    }
    if (atLimit) {
      toast.error(`Досягнуто ліміт ${FREE_ROOMS_LIMIT} кімнати на Free плані`);
      navigate({ to: "/upgrade" });
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Сесія відсутня");
      const path = `${u.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const up = await supabase.storage.from("room-photos").upload(path, file);
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage
        .from("room-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const { data: created, error } = await supabase
        .from("rooms")
        .insert({ user_id: u.user.id, name: name.trim(), photo_url: signed?.signedUrl ?? null })
        .select()
        .single();
      if (error) {
        if (error.message.includes("FREE_PLAN_ROOMS_LIMIT")) {
          toast.error("Ліміт 3 кімнат на Freemium. Перейди на Pro.");
          navigate({ to: "/upgrade" });
          return;
        }
        throw error;
      }
      setName("");
      setFile(null);
      setCreating(false);
      await load();
      navigate({ to: "/rooms/$roomId", params: { roomId: created.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeRoom = async (e: React.MouseEvent, room: Room) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Видалити кімнату «${room.name}» з усіма коробками та речами?`)) return;
    try {
      const { data: containers } = await supabase
        .from("containers")
        .select("id")
        .eq("room_id", room.id);
      const containerIds = (containers ?? []).map((c) => c.id);
      if (containerIds.length > 0) {
        await supabase.from("items").delete().in("container_id", containerIds);
        await supabase.from("containers").delete().eq("room_id", room.id);
      }
      const { error } = await supabase.from("rooms").delete().eq("id", room.id);
      if (error) throw error;
      toast.success("Кімнату видалено");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <main className="px-6 py-8 mx-auto max-w-md">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Мої кімнати</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {rooms.length}
            {plan === "free" ? ` / ${FREE_ROOMS_LIMIT} (Freemium)` : " приміщень"}
          </p>
        </div>
        <button onClick={signOut} className="neu-interactive w-11 h-11 rounded-2xl flex items-center justify-center">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {creating ? (
        <NeuCard className="space-y-3 mb-6">
          <NeuInput placeholder="Назва (Гараж, Комора...)" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="neu-pressed flex items-center gap-2 px-4 h-12 cursor-pointer text-sm text-muted-foreground rounded-[var(--radius)]">
            <ImagePlus className="w-4 h-4" />
            {file ? file.name : "Обрати фото..."}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex gap-2">
            <NeuButton onClick={() => setCreating(false)} className="flex-1">Скасувати</NeuButton>
            <NeuButton variant="primary" onClick={create} disabled={busy} className="flex-1">
              {busy ? "..." : "Створити"}
            </NeuButton>
          </div>
        </NeuCard>
      ) : atLimit ? (
        <NeuCard className="mb-6 text-center space-y-3">
          <Lock className="w-6 h-6 mx-auto text-primary" />
          <p className="text-sm">Ти використав усі 3 кімнати Freemium</p>
          <Link to="/upgrade">
            <NeuButton variant="primary" className="w-full">Перейти на Pro</NeuButton>
          </Link>
        </NeuCard>
      ) : (
        <NeuButton variant="primary" className="w-full mb-6" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> Нова кімната
        </NeuButton>
      )}

      <div className="space-y-3">
        {rooms.map((r) => (
          <div key={r.id} className="relative">
            <Link to="/rooms/$roomId" params={{ roomId: r.id }}>
              <NeuCard className="!p-3 flex gap-3 items-center pr-14">
                {r.photo_url ? (
                  <img src={r.photo_url} alt={r.name} className="w-16 h-16 rounded-2xl object-cover neu-pressed" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl neu-pressed" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{r.name}</div>
                </div>
              </NeuCard>
            </Link>
            <button
              onClick={(e) => removeRoom(e, r)}
              aria-label="Видалити кімнату"
              className="neu-interactive absolute top-1/2 -translate-y-1/2 right-3 w-10 h-10 rounded-2xl flex items-center justify-center text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {rooms.length === 0 && !creating && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Поки порожньо — створи першу кімнату
          </p>
        )}
      </div>
    </main>
  );
}
