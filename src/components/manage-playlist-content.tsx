import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ItemKind = "campaign" | "widget";

interface LibraryItem {
  id: string;
  name: string;
  kind: ItemKind;
  defaultDuration: number;
  meta?: string;
}

interface PlaylistItem {
  uid: string; // local-only stable id for dnd
  refId: string; // campaign or widget id
  kind: ItemKind;
  name: string;
  duration: number;
  meta?: string;
}

interface ManagePlaylistContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  playlist: { id: string; name: string } | null;
}

function newUid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDur(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ManagePlaylistContent({
  open,
  onOpenChange,
  userId,
  playlist,
}: ManagePlaylistContentProps) {
  const qc = useQueryClient();
  const playlistId = playlist?.id ?? null;
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [activeTab, setActiveTab] = useState<"current" | "library">("current");

  // --- Library (campaigns + widgets active) ---
  const libraryQuery = useQuery({
    enabled: open,
    queryKey: ["library", userId],
    queryFn: async () => {
      const [c, w] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id, name, duration_seconds, status")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("dynamic_contents")
          .select("id, name, content_type, is_active")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("name"),
      ]);
      if (c.error) throw c.error;
      if (w.error) throw w.error;
      const lib: LibraryItem[] = [];
      (c.data ?? []).forEach((x) =>
        lib.push({
          id: x.id as string,
          name: (x.name as string) ?? "Sem nome",
          kind: "campaign",
          defaultDuration: (x.duration_seconds as number) ?? 15,
          meta: "Campanha",
        }),
      );
      (w.data ?? []).forEach((x) =>
        lib.push({
          id: x.id as string,
          name: (x.name as string) ?? "Widget",
          kind: "widget",
          defaultDuration: 15,
          meta: (x.content_type as string) ?? "Widget",
        }),
      );
      return lib;
    },
  });

  // --- Existing items ---
  const itemsQuery = useQuery({
    enabled: open && !!playlistId,
    queryKey: ["playlist-items", playlistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_items")
        .select(
          "id, widget_id, campaign_id, duration, display_order, dynamic_contents(name, content_type), campaigns(name)",
        )
        .eq("playlist_id", playlistId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    const data = itemsQuery.data ?? [];
    const built: PlaylistItem[] = data.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      if (r.campaign_id) {
        return {
          uid: newUid(),
          refId: r.campaign_id,
          kind: "campaign",
          name: r.campaigns?.name ?? "Campanha",
          duration: r.duration ?? 15,
          meta: "Campanha",
        };
      }
      return {
        uid: newUid(),
        refId: r.widget_id,
        kind: "widget",
        name: r.dynamic_contents?.name ?? "Widget",
        duration: r.duration ?? 15,
        meta: r.dynamic_contents?.content_type ?? "Widget",
      };
    });
    setItems(built);
  }, [itemsQuery.data, open]);

  // Reset on close
  useEffect(() => {
    if (!open) setItems([]);
  }, [open]);

  const total = useMemo(() => items.reduce((s, i) => s + (i.duration || 0), 0), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.uid === active.id);
      const newIdx = prev.findIndex((i) => i.uid === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function addFromLibrary(li: LibraryItem) {
    setItems((prev) => [
      ...prev,
      {
        uid: newUid(),
        refId: li.id,
        kind: li.kind,
        name: li.name,
        duration: li.defaultDuration,
        meta: li.meta,
      },
    ]);
    setActiveTab("current");
    toast.success(`Adicionado: ${li.name}`);
  }

  function removeItem(uid: string) {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  }

  function updateDuration(uid: string, val: number) {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, duration: Math.max(1, val || 1) } : i)),
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!playlistId) throw new Error("Playlist não selecionada");
      const { error: delError } = await supabase
        .from("playlist_items")
        .delete()
        .eq("playlist_id", playlistId);
      if (delError) throw delError;

      if (items.length > 0) {
        const rows = items.map((it, idx) => ({
          playlist_id: playlistId,
          widget_id: it.kind === "widget" ? it.refId : null,
          campaign_id: it.kind === "campaign" ? it.refId : null,
          item_type: it.kind,
          display_order: idx + 1,
          duration: it.duration,
        }));
        const { error: insError } = await supabase.from("playlist_items").insert(rows);
        if (insError) throw insError;
      }

      const { error: upError } = await supabase
        .from("playlists")
        .update({ duration_total: total })
        .eq("id", playlistId);
      if (upError) throw upError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists", userId] });
      qc.invalidateQueries({ queryKey: ["playlist-items", playlistId] });
      toast.success("Playlist salva");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="truncate">{playlist?.name ?? "Playlist"}</DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? "item" : "itens"} · Duração:{" "}
            <span className="font-medium text-foreground">{formatDur(total)}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "current" | "library")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="px-5 pt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">Conteúdo ({items.length})</TabsTrigger>
              <TabsTrigger value="library">Biblioteca</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="current"
            className="m-0 flex-1 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
          >
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Nenhum item ainda. Vá em <strong>Biblioteca</strong> para adicionar.
                </p>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("library")}>
                  Abrir biblioteca
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((i) => i.uid)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <SortableRow
                        key={item.uid}
                        item={item}
                        onRemove={() => removeItem(item.uid)}
                        onDuration={(v) => updateDuration(item.uid, v)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent
            value="library"
            className="m-0 flex-1 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
          >
            {libraryQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
            ) : (libraryQuery.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma campanha ativa ou widget disponível.
              </p>
            ) : (
              <ul className="space-y-2">
                {(libraryQuery.data ?? []).map((li) => (
                  <Card key={`${li.kind}-${li.id}`} className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          li.kind === "campaign"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                        )}
                      >
                        {li.kind === "campaign" ? (
                          <Megaphone className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{li.name}</p>
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">
                          {li.meta}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addFromLibrary(li)}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t bg-background px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar playlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableRow({
  item,
  onRemove,
  onDuration,
}: {
  item: PlaylistItem;
  onRemove: () => void;
  onDuration: (val: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-card p-3 shadow-sm",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="-ml-1 flex h-10 w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          item.kind === "campaign"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        )}
      >
        {item.kind === "campaign" ? (
          <Megaphone className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{item.meta}</p>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          value={item.duration}
          onChange={(e) => onDuration(parseInt(e.target.value) || 1)}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-9 w-16 text-center text-sm"
        />
        <span className="text-[11px] text-muted-foreground">s</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-9 w-9 shrink-0 p-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
