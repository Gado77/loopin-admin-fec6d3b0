import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Cloud,
  Newspaper,
  Clock,
  Rss,
  TrendingUp,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/page-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_app/dynamic-content")({
  component: DynamicContentPage,
  head: () => ({ meta: [{ title: "Conteúdo Dinâmico — Loopin TV" }] }),
});

type WidgetType = "clock" | "weather" | "news" | "rss" | "stocks";

interface DynamicWidget {
  id: string;
  name: string;
  type: WidgetType;
  config: Record<string, string> | null;
  position: string | null;
  enabled: boolean;
  created_at: string;
}

interface FormState {
  name: string;
  type: WidgetType;
  city: string;
  rss_url: string;
  symbols: string;
  position: string;
  enabled: boolean;
}

const emptyForm: FormState = {
  name: "",
  type: "clock",
  city: "",
  rss_url: "",
  symbols: "",
  position: "bottom",
  enabled: true,
};

const TYPE_META: Record<
  WidgetType,
  { label: string; icon: typeof Cloud; description: string }
> = {
  clock: { label: "Data e Hora", icon: Clock, description: "Relógio digital sobreposto" },
  weather: { label: "Clima", icon: Cloud, description: "Previsão do tempo por cidade" },
  news: { label: "Notícias", icon: Newspaper, description: "Manchetes rotativas" },
  rss: { label: "Feed RSS", icon: Rss, description: "Feed customizado em ticker" },
  stocks: { label: "Cotações", icon: TrendingUp, description: "Ações, câmbio, cripto" },
};

function DynamicContentPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DynamicWidget | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dynamic-widgets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_widgets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DynamicWidget[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config: Record<string, string> = {};
      if (form.type === "weather" && form.city) config.city = form.city.trim();
      if (form.type === "rss" && form.rss_url) config.rss_url = form.rss_url.trim();
      if (form.type === "stocks" && form.symbols)
        config.symbols = form.symbols.trim();

      const payload = {
        user_id: userId,
        name: form.name.trim(),
        type: form.type,
        config: Object.keys(config).length ? config : null,
        position: form.position,
        enabled: form.enabled,
      };
      if (editing) {
        const { error } = await supabase
          .from("dynamic_widgets")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dynamic_widgets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-widgets", userId] });
      toast.success(editing ? "Widget atualizado" : "Widget criado");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("dynamic_widgets")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-widgets", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dynamic_widgets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-widgets", userId] });
      toast.success("Widget excluído");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (w: DynamicWidget) => {
    setEditing(w);
    const cfg = w.config ?? {};
    setForm({
      name: w.name,
      type: w.type,
      city: cfg.city ?? "",
      rss_url: cfg.rss_url ?? "",
      symbols: cfg.symbols ?? "",
      position: w.position ?? "bottom",
      enabled: w.enabled,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  return (
    <>
      <PageHeader
        title="Conteúdo Dinâmico"
        description="Widgets que aparecem sobreposto às suas mídias (clima, notícias, relógio, feeds)."
        icon={Sparkles}
        action={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo widget
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhum widget criado"
          description="Adicione elementos dinâmicos como clima, relógio ou notícias para sobrepor às suas campanhas."
          actionLabel="Criar primeiro widget"
          onAction={openNew}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((w) => {
            const meta = TYPE_META[w.type];
            const Icon = meta.icon;
            return (
              <Card key={w.id} className={!w.enabled ? "opacity-60" : ""}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{w.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">
                          {meta.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={w.enabled}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: w.id, enabled: v })
                        }
                        aria-label="Ativar"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="outline">
                      {w.position === "top"
                        ? "Topo"
                        : w.position === "bottom"
                          ? "Rodapé"
                          : "Ticker"}
                    </Badge>
                    <Badge variant={w.enabled ? "default" : "secondary"}>
                      <Power className="mr-1 h-3 w-3" />
                      {w.enabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(w)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(w.id)}
                      aria-label="Excluir"
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

      <Dialog open={dialogOpen} onOpenChange={(o) => (o ? null : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar widget" : "Novo widget dinâmico"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) {
                toast.error("Informe o nome");
                return;
              }
              saveMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Clima em São Paulo"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as WidgetType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as WidgetType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_META[t].label} — {TYPE_META[t].description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.type === "weather" && (
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Ex: São Paulo, BR"
                />
              </div>
            )}

            {form.type === "rss" && (
              <div className="space-y-2">
                <Label htmlFor="rss">URL do feed RSS</Label>
                <Input
                  id="rss"
                  value={form.rss_url}
                  onChange={(e) => setForm({ ...form, rss_url: e.target.value })}
                  placeholder="https://exemplo.com/feed.xml"
                />
              </div>
            )}

            {form.type === "stocks" && (
              <div className="space-y-2">
                <Label htmlFor="symbols">Símbolos (separe por vírgula)</Label>
                <Input
                  id="symbols"
                  value={form.symbols}
                  onChange={(e) => setForm({ ...form, symbols: e.target.value })}
                  placeholder="PETR4, USD, BTC"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Posição na tela</Label>
              <Select
                value={form.position}
                onValueChange={(v) => setForm({ ...form, position: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Topo</SelectItem>
                  <SelectItem value="bottom">Rodapé</SelectItem>
                  <SelectItem value="ticker">Ticker (linha rolante)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="cursor-pointer">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desligado, não aparece nas telas.
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => (o ? null : setDeleteId(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir widget?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
