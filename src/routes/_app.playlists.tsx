import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ListMusic, Plus, Pencil, Trash2, Repeat, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { ManagePlaylistContent } from "@/components/manage-playlist-content";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/page-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/playlists")({
  component: PlaylistsPage,
  head: () => ({ meta: [{ title: "Playlists — Loopin TV" }] }),
});

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  loop_enabled: boolean | null;
  duration_total: number | null;
}

interface PlaylistForm {
  name: string;
  description: string;
  loop_enabled: boolean;
}

const emptyForm: PlaylistForm = { name: "", description: "", loop_enabled: true };

function PlaylistsPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [form, setForm] = useState<PlaylistForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [managePlaylist, setManagePlaylist] = useState<Playlist | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["playlists", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Playlist[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: PlaylistForm & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("playlists")
          .update({
            name: input.name.trim(),
            description: input.description.trim() || null,
            loop_enabled: input.loop_enabled,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("playlists").insert({
          user_id: userId,
          name: input.name.trim(),
          description: input.description.trim() || null,
          loop_enabled: input.loop_enabled,
          duration_total: 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists", userId] });
      qc.invalidateQueries({ queryKey: ["playlists-select", userId] });
      toast.success(editing ? "Playlist atualizada" : "Playlist criada");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playlists", userId] });
      toast.success("Playlist excluída");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: Playlist) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      loop_enabled: !!p.loop_enabled,
    });
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Playlists"
        description="Organize sequências de mídia para suas telas."
        icon={ListMusic}
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nova playlist
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="Nenhuma playlist criada"
          description="Crie sua primeira playlist para começar a programar conteúdo nas suas telas."
          actionLabel="Criar primeira playlist"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((p) => (
            <Card key={p.id} className="transition-shadow hover:shadow-soft">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                  {p.loop_enabled && (
                    <Badge variant="secondary" className="shrink-0">
                      <Repeat className="mr-1 h-3 w-3" /> Loop
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Duração total:{" "}
                  <span className="font-medium text-foreground">
                    {Math.round((p.duration_total ?? 0) / 60)} min
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setManagePlaylist(p)}
                  >
                    <ListPlus className="mr-1.5 h-3.5 w-3.5" /> Gerenciar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar playlist" : "Nova playlist"}</DialogTitle>
            <DialogDescription>
              Dê um nome e (opcionalmente) descreva o conteúdo desta playlist.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return toast.error("Informe um nome");
              saveMutation.mutate({ ...form, id: editing?.id });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="pl-name">Nome</Label>
              <Input
                id="pl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Promoções de Verão"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-desc">Descrição</Label>
              <Textarea
                id="pl-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Para que serve esta playlist?"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <Label>Reproduzir em loop</Label>
                <p className="text-xs text-muted-foreground">
                  Repete a playlist continuamente.
                </p>
              </div>
              <Switch
                checked={form.loop_enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, loop_enabled: v }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens da playlist também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManagePlaylistContent
        open={!!managePlaylist}
        onOpenChange={(o) => !o && setManagePlaylist(null)}
        userId={userId}
        playlist={managePlaylist}
      />
    </>
  );
}
