import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Mic, MicOff, Trash2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";
import { extractItems, saveItems } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/rooms_/$roomId")({
  component: RoomDetail,
});

type Room = { id: string; name: string; photo_url: string | null };
type Container = { id: string; label: string; x: number; y: number; wall_id: string | null };
type Item = { id: string; name: string; container_id: string };
type Wall = { id: string; name: string; position: number };

function RoomDetail() {
  const { roomId } = Route.useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [activeWallId, setActiveWallId] = useState<string | null>(null); // null = "Усі"
  const [activeId, setActiveId] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const reload = async () => {
    const [{ data: r }, { data: c }, { data: i }, { data: w }] = await Promise.all([
      supabase.from("rooms").select("id,name,photo_url").eq("id", roomId).single(),
      supabase.from("containers").select("id,label,x,y,wall_id").eq("room_id", roomId).order("created_at"),
      supabase.from("items").select("id,name,container_id").order("created_at"),
      supabase.from("walls").select("id,name,position").eq("room_id", roomId).order("position"),
    ]);
    setRoom(r as any);
    setContainers((c as any) ?? []);
    setItems((i as any) ?? []);
    setWalls((w as any) ?? []);
  };

  useEffect(() => {
    reload();
  }, [roomId]);

  const addWall = async () => {
    const name = prompt("Назва стіни (наприклад: Стіна 1)");
    if (!name?.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("walls")
      .insert({ room_id: roomId, user_id: u.user.id, name: name.trim(), position: walls.length })
      .select()
      .single();
    if (error) {
      if (error.message.includes("PLAN_WALLS_REQUIRES_UPGRADE"))
        toast.error("Стіни доступні в Pro та Premium");
      else if (error.message.includes("PLAN_WALLS_LIMIT"))
        toast.error("Досягнуто ліміту стін у цій кімнаті");
      else toast.error(error.message);
      return;
    }
    setWalls((ws) => [...ws, data as any]);
    setActiveWallId(data.id);
  };

  const removeWall = async (wallId: string) => {
    if (!confirm("Видалити стіну? Коробки залишаться, але без прив'язки.")) return;
    await supabase.from("walls").delete().eq("id", wallId);
    if (activeWallId === wallId) setActiveWallId(null);
    reload();
  };

  const onPhotoTap = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const visibleCount = containers.filter((c) => c.wall_id === activeWallId).length;
    const { data, error } = await supabase
      .from("containers")
      .insert({
        room_id: roomId,
        user_id: u.user.id,
        label: `${visibleCount + 1}`,
        x,
        y,
        wall_id: activeWallId,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setContainers((c) => [...c, data as any]);
    setActiveId(data.id);
  };

  const visibleContainers = containers.filter((c) =>
    activeWallId === null ? true : c.wall_id === activeWallId
  );
  const active = containers.find((c) => c.id === activeId);
  const activeItems = items.filter((i) => i.container_id === activeId);

  return (
    <main className="px-4 py-6 mx-auto max-w-md">
      <Link to="/rooms" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Кімнати
      </Link>
      <h1 className="text-xl font-bold mb-1">{room?.name ?? "..."}</h1>
      <p className="text-xs text-muted-foreground mb-3">Тапни по фото — додай коробку</p>

      {/* Walls strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        <button
          onClick={() => setActiveWallId(null)}
          className={`shrink-0 px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
            activeWallId === null ? "neu-pressed text-primary" : "neu-raised-sm text-muted-foreground"
          }`}
        >
          Усі
        </button>
        {walls.map((w) => (
          <div key={w.id} className="shrink-0 flex items-center">
            <button
              onClick={() => setActiveWallId(w.id)}
              className={`px-3 py-1.5 rounded-l-2xl text-xs font-medium ${
                activeWallId === w.id ? "neu-pressed text-primary" : "neu-raised-sm text-muted-foreground"
              }`}
            >
              {w.name}
            </button>
            {activeWallId === w.id && (
              <button
                onClick={() => removeWall(w.id)}
                className="neu-raised-sm rounded-r-2xl px-2 py-1.5 text-destructive"
                title="Видалити стіну"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addWall}
          className="shrink-0 neu-raised-sm px-3 py-1.5 rounded-2xl text-xs font-medium text-primary flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Стіна
        </button>
      </div>

      {room?.photo_url && (
        <div className="relative neu-pressed rounded-3xl overflow-hidden">
          <img
            ref={imgRef}
            src={room.photo_url}
            alt={room.name}
            className="w-full block cursor-crosshair"
            onClick={onPhotoTap}
          />
          {visibleContainers.map((c) => (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(c.id);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                c.id === activeId
                  ? "gradient-primary scale-110"
                  : "bg-background neu-raised-sm text-primary"
              }`}
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {active && (
        <ContainerDrawer
          container={active}
          items={activeItems}
          onClose={() => setActiveId(null)}
          onChanged={reload}
        />
      )}
    </main>
  );
}

function ContainerDrawer({
  container,
  items,
  onClose,
  onChanged,
}: {
  container: Container;
  items: Item[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(container.label);
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<any>(null);
  const extract = useServerFn(extractItems);
  const save = useServerFn(saveItems);

  useEffect(() => setLabel(container.label), [container.id]);

  const renameLabel = async () => {
    if (label === container.label) return;
    await supabase.from("containers").update({ label }).eq("id", container.id);
    onChanged();
  };

  const removeContainer = async () => {
    if (!confirm("Видалити цю коробку та її вміст?")) return;
    await supabase.from("containers").delete().eq("id", container.id);
    onChanged();
    onClose();
  };

  const startRecording = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Браузер не підтримує розпізнавання мови. Введи список вручну.");
      return;
    }
    const r = new SR();
    r.lang = "uk-UA";
    r.interimResults = true;
    r.continuous = true;
    // Зберігаємо фінальні фрагменти за індексом, щоб уникнути дублів
    // (Android Chrome може повторно емітити той самий resultIndex)
    const finals = new Map<number, string>();
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finals.set(i, chunk.trim());
        } else if (i >= e.resultIndex) {
          interim += chunk;
        }
      }
      const finalText = Array.from(finals.values()).filter(Boolean).join(" ");
      setTranscript((finalText + " " + interim).replace(/\s+/g, " ").trim());
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    r.start();
    recRef.current = r;
    setRecording(true);
  };

  const stopRecording = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const processAndSave = async () => {
    if (!transcript.trim()) {
      toast.error("Спочатку надиктуй або введи текст");
      return;
    }
    setBusy(true);
    try {
      const { items: extracted } = await extract({ data: { rawText: transcript.trim() } });
      if (!extracted.length) {
        toast.error("Не вдалося розпізнати речі. Спробуй ще раз.");
        return;
      }
      await save({ data: { containerId: container.id, items: extracted, replace: false } });
      toast.success(`Збережено ${extracted.length} речей`);
      setTranscript("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-background rounded-t-[2rem] p-6 pb-28 max-h-[90vh] overflow-y-auto neu-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-muted mx-auto mb-6" />
        <div className="flex items-center gap-2 mb-4">
          <NeuInput value={label} onChange={(e) => setLabel(e.target.value)} onBlur={renameLabel} className="flex-1" />
          <button onClick={removeContainer} className="neu-interactive w-12 h-12 rounded-2xl flex items-center justify-center text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase text-muted-foreground mb-2 px-1">У коробці</h3>
            <div className="flex flex-wrap gap-2">
              {items.map((i) => (
                <span key={i.id} className="neu-pressed pl-3 pr-1 py-1 rounded-2xl text-sm flex items-center gap-1">
                  {i.name}
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("items").delete().eq("id", i.id);
                      if (error) toast.error(error.message);
                      else onChanged();
                    }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                    title="Видалити"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <h3 className="text-xs uppercase text-muted-foreground mb-2 px-1">Додати речі</h3>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Натисни мікрофон і надиктуй або введи речі через кому..."
          className="neu-pressed w-full min-h-24 p-4 text-sm rounded-[var(--radius)] outline-none resize-none"
        />

        <div className="flex gap-3 mt-4 items-center">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              recording ? "gradient-primary animate-neu-pulse" : "neu-interactive"
            }`}
          >
            {recording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6 text-primary" />}
          </button>
          <NeuButton variant="primary" className="flex-1" onClick={processAndSave} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Зберегти"}
          </NeuButton>
        </div>
      </div>
    </div>
  );
}
