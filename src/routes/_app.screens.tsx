import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  MonitorPlay,
  Plus,
  Pencil,
  Trash2,
  Search,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/page-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScreenDiagnosticsDialog } from "@/components/screen-diagnostics-dialog";

export const Route = createFileRoute("/_app/screens")({
  component: ScreensPage,
  head: () => ({ meta: [{ title: "Telas — Loopin TV" }] }),
});

interface Screen {
  id: string;
  name: string;
  device_id: string | null;
  location_id: string | null;
  active_playlist_id: string | null;
  orientation: string | null;
  is_muted: boolean | null;
  is_paused: boolean | null;
  status: string | null;
  last_ping: string | null;
  current_content: string | null;
  playlist_items_count: number | null;
  cache_used_mb: number | null;
  locations?: { name: string } | null;
  playlists?: { name: string } | null;
}

type Orientation =
  | "landscape"
  | "portrait"
  | "landscape_inverted"
  | "portrait_inverted";

const ORIENTATION_LABELS: Record<Orientation, string> = {
  landscape: "Horizontal",
  portrait: "Vertical",
  landscape_inverted: "Horizontal invertida",
  portrait_inverted: "Vertical invertida",
};

interface ScreenFormData {
  name: string;
  device_id: string;
  location_id: string;
  active_playlist_id: string;
  orientation: Orientation;
  is_muted: boolean;
}

const emptyForm: ScreenFormData = {
  name: "",
  device_id: "",
  location_id: "",
  active_playlist_id: "",
  orientation: "landscape",
  is_muted: false,
};

function ScreensPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [form, setForm] = useState<ScreenFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [diagnosticsScreen, setDiagnosticsScreen] = useState<Screen | null>(null);

  const screensQuery = useQuery({
    queryKey: ["screens", userId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screens")
        .select("*, locations(name), playlists(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Screen[];
    },
  });

  const locationsQuery = useQuery({
    queryKey: ["locations-select", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const playlistsQuery = useQuery({
    queryKey: ["playlists-select", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: ScreenFormData & { id?: string }) => {
      const device_id = input.device_id.trim().toUpperCase();
      const payload = {
        name: input.name.trim(),
        location_id: input.location_id || null,
        active_playlist_id: input.active_playlist_id || null,
        orientation: input.orientation,
        is_muted: input.is_muted,
      };
      if (input.id) {
        const { error } = await supabase
          .from("screens")
          .update({ ...payload, device_id })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        // Verifica se device_id já existe
        const { data: existing, error: checkErr } = await supabase
          .from("screens")
          .select("id")
          .eq("device_id", device_id)
          .limit(1);
        if (checkErr) throw checkErr;
        if (existing && existing.length > 0) {
          throw new Error("Este código de tela já está cadastrado");
        }
        const { error } = await supabase.from("screens").insert({
          ...payload,
          device_id,
          user_id: userId,
          status: "offline",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens", userId] });
      toast.success(editing ? "Tela atualizada" : "Tela vinculada com sucesso");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("screens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screens", userId] });
      toast.success("Tela excluída");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Screen) => {
    setEditing(s);
    setForm({
      name: s.name,
      device_id: s.device_id ?? "",
      location_id: s.location_id ?? "",
      active_playlist_id: s.active_playlist_id ?? "",
      orientation: (s.orientation as Orientation) ?? "landscape",
      is_muted: !!s.is_muted,
    });
    setDialogOpen(true);
  };

  const filtered = (screensQuery.data ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isOnline = (lastPing: string | null) =>
    !!lastPing && Date.now() - new Date(lastPing).getTime() < 2 * 60 * 1000;

  // Mantém os dados do modal de diagnóstico sempre sincronizados
  const liveDiagnosticsScreen = diagnosticsScreen
    ? ((screensQuery.data ?? []).find((s) => s.id === diagnosticsScreen.id) ??
      diagnosticsScreen)
    : null;

  return (
    <>
      <PageHeader
        title="Telas"
        description="Cadastre e monitore suas TVs e displays."
        icon={MonitorPlay}
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nova tela
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {screensQuery.isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MonitorPlay}
          title={search ? "Nada encontrado" : "Você ainda não tem telas"}
          description={
            search
              ? "Tente outro termo de busca."
              : "Cadastre sua primeira tela para começar a exibir conteúdo."
          }
          actionLabel={search ? undefined : "Cadastrar primeira tela"}
          onAction={search ? undefined : openCreate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const online = isOnline(s.last_ping);
            return (
              <Card key={s.id} className="overflow-hidden transition-shadow hover:shadow-soft">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{s.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {s.locations?.name ?? "Sem local"} ·{" "}
                        {ORIENTATION_LABELS[(s.orientation as Orientation) ?? "landscape"]}
                      </p>
                    </div>
                    <Badge variant={online ? "default" : "secondary"} className="shrink-0">
                      {online ? (
                        <Wifi className="mr-1 h-3 w-3" />
                      ) : (
                        <WifiOff className="mr-1 h-3 w-3" />
                      )}
                      {online ? "Online" : "Offline"}
                    </Badge>
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">
                    Playlist:{" "}
                    <span className="font-medium text-foreground">
                      {s.playlists?.name ?? "Nenhuma"}
                    </span>
                  </p>
                  {s.device_id && (
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                      {s.device_id}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setDiagnosticsScreen(s)}
                    >
                      <Activity className="mr-1.5 h-3.5 w-3.5" /> Diagnóstico
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tela" : "Nova tela"}</DialogTitle>
            <DialogDescription>
              Informe o código exibido na TV pelo aplicativo player para
              vincular esta tela ao painel.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) {
                toast.error("Informe um nome");
                return;
              }
              if (!form.device_id.trim()) {
                toast.error("Informe o código de pareamento");
                return;
              }
              saveMutation.mutate({ ...form, id: editing?.id });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="device_id">
                Código de pareamento{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="device_id"
                value={form.device_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    device_id: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="TELA-XXXXXX"
                className="font-mono tracking-widest uppercase"
                disabled={!!editing}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Esse código aparece na tela do aplicativo Android instalado na TV.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome da tela</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Recepção – Loja 1"
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Local</Label>
                <Select
                  value={form.location_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, location_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(locationsQuery.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                    {(locationsQuery.data ?? []).length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum local cadastrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Playlist</Label>
                <Select
                  value={form.active_playlist_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, active_playlist_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(playlistsQuery.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {(playlistsQuery.data ?? []).length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Crie uma playlist primeiro
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Orientação</Label>
                <Select
                  value={form.orientation}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, orientation: v as Orientation }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Horizontal</SelectItem>
                    <SelectItem value="portrait">Vertical</SelectItem>
                    <SelectItem value="landscape_inverted">
                      Horizontal invertida
                    </SelectItem>
                    <SelectItem value="portrait_inverted">
                      Vertical invertida
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* device_id já visível no topo do formulário */}

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div>
                <Label className="text-sm">Iniciar sem áudio</Label>
                <p className="text-xs text-muted-foreground">
                  Recomendado para ambientes silenciosos.
                </p>
              </div>
              <Switch
                checked={form.is_muted}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_muted: v }))}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? "Salvando…"
                  : editing
                    ? "Salvar alterações"
                    : "Vincular tela"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta tela?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tela será removida do painel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScreenDiagnosticsDialog
        screen={liveDiagnosticsScreen}
        open={!!diagnosticsScreen}
        onOpenChange={(o) => !o && setDiagnosticsScreen(null)}
      />
    </>
  );
}
