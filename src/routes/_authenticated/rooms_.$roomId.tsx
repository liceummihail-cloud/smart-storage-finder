import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, ImagePlus, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/rooms_/$roomId")({
  component: RoomDetail,
});

type Room = { id: string; name: string; photo_url: string | null };
type Wall = {
  id: string;
  name: string;
  position: number;
  photo_url: string | null;
};
type Plan = "free" | "pro" | "yearly" | "premium";

const WALL_LIMITS: Record<Plan, number> = {
  free: 1,
  pro: 5,
  yearly: 7,
  premium: 7,
};

function RoomDetail() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<Plan>("free");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: r }, { data: w }, { data: c }, { data: prof }] =
      await Promise.all([
        supabase
          .from("rooms")
          .select("id,name,photo_url")
          .eq("id", roomId)
          .single(),
        supabase
          .from("walls")
          .select("id,name,position,photo_url")
          .eq("room_id", roomId)
          .order("position"),
        supabase
          .from("containers")
          .select("id,wall_id")
          .eq("room_id", roomId),
        supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", u.user.id)
          .maybeSingle(),
      ]);
    setRoom(r as any);
    setWalls((w as any) ?? []);
    setPlan((prof?.plan as Plan) ?? "free");
    const m: Record<string, number> = {};
    (c ?? []).forEach((x: any) => {
      if (x.wall_id) m[x.wall_id] = (m[x.wall_id] ?? 0) + 1;
    });
    setCounts(m);
  };

  useEffect(() => {
    load();
  }, [roomId]);

  const limit = WALL_LIMITS[plan];
  const atLimit = walls.length >= limit;

  const create = async () => {
    if (!name.trim() || !file) {
      toast.error("Додай назву та фото стіни");
      return;
    }
    if (atLimit) {
      toast.error(`Ліміт ${limit} стін на плані ${plan.toUpperCase()}`);
      navigate({ to: "/upgrade" });
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Сесія відсутня");
      const path = `${u.user.id}/walls/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const up = await supabase.storage.from("room-photos").upload(path, file);
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage
        .from("room-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const { data: created, error } = await supabase
        .from("walls")
        .insert({
          room_id: roomId,
          user_id: u.user.id,
          name: name.trim(),
          position: walls.length,
          photo_url: signed?.signedUrl ?? null,
        })
        .select()
        .single();
      if (error) {
        if (error.message.includes("PLAN_WALLS_LIMIT")) {
          toast.error("Ліміт стін досягнуто");
          navigate({ to: "/upgrade" });
          return;
        }
        throw error;
      }
      setName("");
      setFile(null);
      setCreating(false);
      navigate({
        to: "/rooms/$roomId/walls/$wallId",
        params: { roomId, wallId: created.id },
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeWall = async (e: React.MouseEvent, wall: Wall) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Видалити стіну «${wall.name}» з усіма коробками?`)) return;
    try {
      const { data: cs } = await supabase
        .from("containers")
        .select("id")
        .eq("wall_id", wall.id);
      const ids = (cs ?? []).map((c) => c.id);
      if (ids.length) {
        await supabase.from("items").delete().in("container_id", ids);
        await supabase.from("containers").delete().in("id", ids);
      }
      await supabase.from("walls").delete().eq("id", wall.id);
      toast.success("Стіну видалено");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <main className="px-4 py-6 mx-auto max-w-md">
      <Link
        to="/rooms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Кімнати
      </Link>
      <h1 className="text-xl font-bold mb-1">{room?.name ?? "..."}</h1>
      <p className="text-xs text-muted-foreground mb-4">
        {walls.length} / {limit} стін
      </p>

      {creating ? (
        <NeuCard className="space-y-3 mb-6">
          <NeuInput
            placeholder="Назва стіни (Північна, Полиці...)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="neu-pressed flex items-center gap-2 px-4 h-12 cursor-pointer text-sm text-muted-foreground rounded-[var(--radius)]">
            <ImagePlus className="w-4 h-4" />
            {file ? file.name : "Фото стіни..."}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex gap-2">
            <NeuButton onClick={() => setCreating(false)} className="flex-1">
              Скасувати
            </NeuButton>
            <NeuButton
              variant="primary"
              onClick={create}
              disabled={busy}
              className="flex-1"
            >
              {busy ? "..." : "Створити"}
            </NeuButton>
          </div>
        </NeuCard>
      ) : atLimit ? (
        <NeuCard className="mb-6 text-center space-y-3">
          <Lock className="w-6 h-6 mx-auto text-primary" />
          <p className="text-sm">
            Ліміт {limit} стін на плані {plan.toUpperCase()}
          </p>
          <Link to="/upgrade">
            <NeuButton variant="primary" className="w-full">
              Оновити план
            </NeuButton>
          </Link>
        </NeuCard>
      ) : (
        <NeuButton
          variant="primary"
          className="w-full mb-6"
          onClick={() => setCreating(true)}
        >
          <Plus className="w-4 h-4" /> Нова стіна
        </NeuButton>
      )}

      <div className="space-y-3">
        {walls.map((w) => (
          <div key={w.id} className="relative">
            <Link
              to="/rooms/$roomId/walls/$wallId"
              params={{ roomId, wallId: w.id }}
            >
              <NeuCard className="!p-3 flex gap-3 items-center pr-14">
                {w.photo_url ? (
                  <img
                    src={w.photo_url}
                    alt={w.name}
                    className="w-16 h-16 rounded-2xl object-cover neu-pressed"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl neu-pressed" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {counts[w.id] ?? 0} коробок
                  </div>
                </div>
              </NeuCard>
            </Link>
            <button
              onClick={(e) => removeWall(e, w)}
              aria-label="Видалити стіну"
              className="neu-interactive absolute top-1/2 -translate-y-1/2 right-3 w-10 h-10 rounded-2xl flex items-center justify-center text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {walls.length === 0 && !creating && (
          <p className="text-center text-sm text-muted-foreground py-12">
            Створи першу стіну — це може бути полиця, шафа чи частина кімнати
          </p>
        )}
      </div>
    </main>
  );
}
