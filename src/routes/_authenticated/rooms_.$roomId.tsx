import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Mic, MicOff, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NeuButton, NeuCard, NeuInput } from "@/components/neu";
import { supabase } from "@/integrations/supabase/client";
import { extractItems, saveItems } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/rooms_/$roomId")({
  component: RoomDetail,
});

type Room = { id: string; name: string; photo_url: string | null };
type Container = { id: string; label: string; x: number; y: number };
type Item = { id: string; name: string; container_id: string };

function RoomDetail() {
  const { roomId } = Route.useParams();
  const [room, setRoom] = useState<Room | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const reload = async () => {
    const [{ data: r }, { data: c }, { data: i }] = await Promise.all([
      supabase.from("rooms").select("id,name,photo_url").eq("id", roomId).single(),
      supabase.from("containers").select("id,label,x,y").eq("room_id", roomId).order("created_at"),
      supabase.from("items").select("id,name,container_id").order("created_at"),
    ]);
    setRoom(r as any);
    setContainers((c as any) ?? []);
    setItems((i as any) ?? []);
  };

  useEffect(() => {
    reload();
  }, [roomId]);

  const onPhotoTap = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("containers")
      .insert({ room_id: roomId, user_id: u.user.id, label: `${containers.length + 1}`, x, y })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setContainers((c) => [...c, data as any]);
    setActiveId(data.id);
  };

  const active = containers.find((c) => c.id === activeId);
  const activeItems = items.filter((i) => i.container_id === activeId);

  return (
    <main className="px-4 py-6 mx-auto max-w-md">
      <Link to="/rooms" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Кімнати
      </Link>
      <h1 className="text-xl font-bold mb-1">{room?.name ?? "..."}</h1>
      <p className="text-xs text-muted-foreground mb-4">Тапни по фото — додай коробку</p>

      {room?.photo_url && (
        <div className="relative neu-pressed rounded-3xl overflow-hidden">
          <img
            ref={imgRef}
            src={room.photo_url}
            alt={room.name}
            className="w-full block cursor-crosshair"
            onClick={onPhotoTap}
          />
          {containers.map((c) => (
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
    let acc = "";
    r.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          acc += chunk + " ";
        } else {
          txt += chunk;
        }
      }
      setTranscript(acc + txt);
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
                <span key={i.id} className="neu-pressed px-3 py-1.5 rounded-2xl text-sm">
                  {i.name}
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
