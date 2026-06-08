import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Trash2,
  Loader2,
  X,
  Move,
  ImagePlus,
  Check,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";
import { extractItems, saveItems } from "@/lib/ai.functions";

export const Route = createFileRoute(
  "/_authenticated/rooms_/$roomId/walls_/$wallId",
)({
  component: WallDetail,
});

type Wall = { id: string; name: string; photo_url: string | null; room_id: string };
type Container = {
  id: string;
  label: string;
  x: number;
  y: number;
  wall_id: string | null;
};
type Item = { id: string; name: string; container_id: string };
type Plan = "free" | "pro" | "yearly" | "premium";

function WallDetail() {
  const { roomId, wallId } = Route.useParams();
  const [wall, setWall] = useState<Wall | null>(null);
  const [roomName, setRoomName] = useState("");
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [plan, setPlan] = useState<Plan>("free");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftCoords, setDraftCoords] = useState<Record<string, { x: number; y: number }>>({});
  const [movingPhoto, setMovingPhoto] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<string | null>(null);

  const isPro = plan === "pro" || plan === "yearly" || plan === "premium";

  const reload = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: w }, { data: c }, { data: i }, { data: prof }, { data: r }] =
      await Promise.all([
        supabase
          .from("walls")
          .select("id,name,photo_url,room_id")
          .eq("id", wallId)
          .single(),
        supabase
          .from("containers")
          .select("id,label,x,y,wall_id")
          .eq("wall_id", wallId)
          .order("created_at"),
        supabase.from("items").select("id,name,container_id").order("created_at"),
        supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", u.user.id)
          .maybeSingle(),
        supabase.from("rooms").select("name").eq("id", roomId).single(),
      ]);
    setWall(w as any);
    setContainers((c as any) ?? []);
    setItems((i as any) ?? []);
    setPlan((prof?.plan as Plan) ?? "free");
    setRoomName((r as any)?.name ?? "");
  };

  useEffect(() => {
    reload();
  }, [wallId]);

  const onPhotoTap = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (editMode || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("containers")
      .insert({
        room_id: roomId,
        user_id: u.user.id,
        label: `${containers.length + 1}`,
        x,
        y,
        wall_id: wallId,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setContainers((cs) => [...cs, data as any]);
    setActiveId(data.id);
  };

  // Drag handlers (pointer events for mobile+desktop)
  const startDrag = (e: React.PointerEvent, id: string) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!editMode || !dragRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDraftCoords((d) => ({ ...d, [dragRef.current!]: { x, y } }));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const saveCoords = async () => {
    const entries = Object.entries(draftCoords);
    if (!entries.length) {
      setEditMode(false);
      return;
    }
    for (const [id, { x, y }] of entries) {
      await supabase.from("containers").update({ x, y }).eq("id", id);
    }
    setContainers((cs) =>
      cs.map((c) => (draftCoords[c.id] ? { ...c, ...draftCoords[c.id] } : c)),
    );
    setDraftCoords({});
    setEditMode(false);
    toast.success("Розташування збережено");
  };

  const cancelEdit = () => {
    setDraftCoords({});
    setEditMode(false);
  };

  const updatePhoto = async (file: File) => {
    setMovingPhoto(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Сесія відсутня");
      const path = `${u.user.id}/walls/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const up = await supabase.storage.from("room-photos").upload(path, file);
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage
        .from("room-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error } = await supabase
        .from("walls")
        .update({ photo_url: signed?.signedUrl ?? null })
        .eq("id", wallId);
      if (error) throw error;
      await reload();
      if (containers.length > 0) {
        setEditMode(true);
        toast.success("Фото оновлено — підправ маркери");
      } else {
        toast.success("Фото оновлено");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMovingPhoto(false);
    }
  };

  const active = containers.find((c) => c.id === activeId);
  const activeItems = items.filter((i) => i.container_id === activeId);

  const coordOf = (c: Container) => draftCoords[c.id] ?? { x: c.x, y: c.y };

  return (
    <main className="px-4 py-6 mx-auto max-w-md">
      <Link
        to="/rooms/$roomId"
        params={{ roomId }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> {roomName || "Кімната"}
      </Link>
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl font-bold">{wall?.name ?? "..."}</h1>
        <span className="text-xs text-muted-foreground">
          {containers.length} коробок
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {editMode ? "Перетягни маркери" : "Тапни по фото — додай коробку"}
      </p>

      {/* Toolbar */}
      <div className="flex gap-2 mb-3">
        <label className="neu-interactive flex-1 h-10 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs cursor-pointer">
          {movingPhoto ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          Оновити фото
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && updatePhoto(e.target.files[0])}
          />
        </label>
        {editMode ? (
          <>
            <button
              onClick={cancelEdit}
              className="neu-interactive h-10 px-3 rounded-2xl text-xs"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={saveCoords}
              className="neu-interactive h-10 px-4 rounded-2xl text-xs gradient-primary !text-primary-foreground font-semibold flex items-center gap-1"
            >
              <Check className="w-4 h-4" /> Зберегти
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              if (!isPro) {
                toast.error("Редагування маркерів доступне в Pro/Yearly");
                return;
              }
              setEditMode(true);
            }}
            className="neu-interactive h-10 px-3 rounded-2xl text-xs flex items-center gap-1"
          >
            <Move className="w-4 h-4" /> Редагувати
          </button>
        )}
      </div>

      {wall?.photo_url ? (
        <div
          className="relative neu-pressed rounded-3xl overflow-hidden select-none"
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            ref={imgRef}
            src={wall.photo_url}
            alt={wall.name}
            className={`w-full block ${editMode ? "" : "cursor-crosshair"}`}
            onClick={onPhotoTap}
            draggable={false}
          />
          {containers.map((c) => {
            const { x, y } = coordOf(c);
            return (
              <button
                key={c.id}
                onPointerDown={(e) => startDrag(e, c.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!editMode) setActiveId(c.id);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-transform ${
                  editMode
                    ? "gradient-primary scale-110 cursor-grab active:cursor-grabbing"
                    : c.id === activeId
                      ? "gradient-primary scale-110"
                      : "bg-background neu-raised-sm text-primary"
                }`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, touchAction: "none" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : (
        <NeuCard className="text-center text-sm text-muted-foreground">
          Додай фото стіни щоб почати
        </NeuCard>
      )}

      {active && !editMode && (
        <ContainerDrawer
          container={active}
          items={activeItems}
          isPro={isPro}
          roomId={roomId}
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
  isPro,
  roomId,
  onClose,
  onChanged,
}: {
  container: Container;
  items: Item[];
  isPro: boolean;
  roomId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(container.label);
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
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
    const finals = new Map<number, string>();
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finals.set(i, chunk.trim());
        else if (i >= e.resultIndex) interim += chunk;
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
      const { items: extracted } = await extract({
        data: { rawText: transcript.trim() },
      });
      if (!extracted.length) {
        toast.error("Не вдалося розпізнати речі. Спробуй ще раз.");
        return;
      }
      await save({
        data: { containerId: container.id, items: extracted, replace: false },
      });
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
    <div
      className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto bg-background rounded-t-[2rem] p-6 pb-28 max-h-[90vh] overflow-y-auto neu-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-muted mx-auto mb-6" />
        <div className="flex items-center gap-2 mb-4">
          <NeuInput
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={renameLabel}
            className="flex-1"
          />
          <button
            onClick={() => {
              if (!isPro) {
                toast.error("Переміщення доступне в Pro/Yearly");
                return;
              }
              setMoveOpen(true);
            }}
            className="neu-interactive w-12 h-12 rounded-2xl flex items-center justify-center text-primary"
            title="Перемістити"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <button
            onClick={removeContainer}
            className="neu-interactive w-12 h-12 rounded-2xl flex items-center justify-center text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase text-muted-foreground mb-2 px-1">
              У коробці
            </h3>
            <div className="flex flex-wrap gap-2">
              {items.map((i) => (
                <span
                  key={i.id}
                  className="neu-pressed pl-3 pr-1 py-1 rounded-2xl text-sm flex items-center gap-1"
                >
                  {i.name}
                  <button
                    onClick={async () => {
                      const { error } = await supabase
                        .from("items")
                        .delete()
                        .eq("id", i.id);
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

        <h3 className="text-xs uppercase text-muted-foreground mb-2 px-1">
          Додати речі
        </h3>
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
            {recording ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6 text-primary" />
            )}
          </button>
          <NeuButton
            variant="primary"
            className="flex-1"
            onClick={processAndSave}
            disabled={busy}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Зберегти"}
          </NeuButton>
        </div>

        {moveOpen && (
          <MoveDialog
            container={container}
            currentRoomId={roomId}
            onDone={() => {
              setMoveOpen(false);
              onChanged();
              onClose();
            }}
            onCancel={() => setMoveOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function MoveDialog({
  container,
  currentRoomId,
  onDone,
  onCancel,
}: {
  container: Container;
  currentRoomId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [walls, setWalls] = useState<
    { id: string; name: string; room_id: string }[]
  >([]);
  const [roomId, setRoomId] = useState(currentRoomId);
  const [wallId, setWallId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: w }] = await Promise.all([
        supabase.from("rooms").select("id,name").order("created_at"),
        supabase.from("walls").select("id,name,room_id").order("position"),
      ]);
      setRooms((r as any) ?? []);
      setWalls((w as any) ?? []);
    })();
  }, []);

  const wallsForRoom = walls.filter(
    (w) => w.room_id === roomId && w.id !== container.wall_id,
  );

  const submit = async () => {
    if (!wallId) {
      toast.error("Обери стіну");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("containers")
        .update({ wall_id: wallId, room_id: roomId })
        .eq("id", container.id);
      if (error) throw error;
      toast.success("Коробку переміщено");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <NeuCard
        className="w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold">Перемістити коробку</h3>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Кімната
          </label>
          <select
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setWallId("");
            }}
            className="neu-pressed w-full h-12 px-4 rounded-[var(--radius)] outline-none text-sm bg-transparent"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Стіна
          </label>
          <select
            value={wallId}
            onChange={(e) => setWallId(e.target.value)}
            className="neu-pressed w-full h-12 px-4 rounded-[var(--radius)] outline-none text-sm bg-transparent"
          >
            <option value="">— оберіть —</option>
            {wallsForRoom.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {wallsForRoom.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              У цій кімнаті немає інших стін
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <NeuButton onClick={onCancel} className="flex-1">
            Скасувати
          </NeuButton>
          <NeuButton
            variant="primary"
            onClick={submit}
            disabled={busy}
            className="flex-1"
          >
            {busy ? "..." : "Перемістити"}
          </NeuButton>
        </div>
      </NeuCard>
    </div>
  );
}
