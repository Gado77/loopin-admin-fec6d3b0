import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Cloud,
  Newspaper,
  Type,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_app/dynamic-content")({
  component: DynamicContentPage,
  head: () => ({ meta: [{ title: "Conteúdo Dinâmico — Loopin TV" }] }),
});

type ContentType = "weather" | "news" | "ticker" | "html";

interface DynamicContent {
  id: string;
  name: string;
  content_type: ContentType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configuration: any;
  is_active: boolean;
  created_at: string;
}

interface FormState {
  name: string;
  content_type: ContentType;
  is_active: boolean;
  // weather
  city: string;
  weatherInterval: number;
  // news
  newsCategory: string;
  newsInterval: number;
  // ticker
  tickerText: string;
  tickerSpeed: number;
  // html
  html: string;
}

const empty: FormState = {
  name: "",
  content_type: "weather",
  is_active: true,
  city: "São José dos Pinhais, BR",
  weatherInterval: 30,
  newsCategory: "general",
  newsInterval: 60,
  tickerText: "",
  tickerSpeed: 50,
  html: "",
};

const TYPE_META: Record<
  ContentType,
  { label: string; icon: typeof Cloud; color: string }
> = {
  weather: { label: "Clima", icon: Cloud, color: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  news: { label: "Notícias", icon: Newspaper, color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  ticker: { label: "Ticker", icon: Type, color: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  html: { label: "HTML Custom", icon: Code2, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

const BRAZILIAN_CITIES = [
  { value: "São José dos Pinhais, BR", label: "São José dos Pinhais - PR" },
  { value: "São Paulo, BR", label: "São Paulo - SP" },
  { value: "Rio de Janeiro, BR", label: "Rio de Janeiro - RJ" },
  { value: "Belo Horizonte, BR", label: "Belo Horizonte - MG" },
  { value: "Brasília, BR", label: "Brasília - DF" },
  { value: "Salvador, BR", label: "Salvador - BA" },
  { value: "Fortaleza, BR", label: "Fortaleza - CE" },
  { value: "Recife, BR", label: "Recife - PE" },
  { value: "Porto Alegre, BR", label: "Porto Alegre - RS" },
  { value: "Curitiba, BR", label: "Curitiba - PR" },
  { value: "Manaus, BR", label: "Manaus - AM" },
  { value: "Natal, BR", label: "Natal - RN" },
  { value: "João Pessoa, BR", label: "João Pessoa - PB" },
  { value: "Florianópolis, BR", label: "Florianópolis - SC" },
  { value: "Cuiabá, BR", label: "Cuiabá - MT" },
  { value: "Goiânia, BR", label: "Goiânia - GO" },
];

function buildConfig(f: FormState) {
  if (f.content_type === "weather") return { city: f.city, interval: f.weatherInterval };
  if (f.content_type === "news") return { category: f.newsCategory, interval: f.newsInterval };
  if (f.content_type === "ticker") return { text: f.tickerText, speed: f.tickerSpeed };
  if (f.content_type === "html") return { html: f.html };
  return {};
}

function DynamicContentPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dynamic-contents", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_contents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DynamicContent[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: FormState) => {
      const { error } = await supabase.from("dynamic_contents").insert({
        user_id: userId,
        name: input.name.trim(),
        content_type: input.content_type,
        configuration: buildConfig(input),
        is_active: input.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-contents", userId] });
      qc.invalidateQueries({ queryKey: ["library", userId] });
      toast.success("Widget criado");
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (w: DynamicContent) => {
      const { error } = await supabase
        .from("dynamic_contents")
        .update({ is_active: !w.is_active })
        .eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic-contents", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_contents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-contents", userId] });
      toast.success("Widget excluído");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Conteúdo Dinâmico"
        description="Widgets de clima, notícias, ticker e HTML para reproduzir nas suas playlists."
        icon={Sparkles}
        action={
          <Button
            onClick={() => {
              setForm(empty);
              setOpen(true);
            }}
          >
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
          description="Adicione widgets dinâmicos para enriquecer suas playlists."
          actionLabel="Criar primeiro widget"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((w) => {
            const meta = TYPE_META[w.content_type] ?? TYPE_META.html;
            const Icon = meta.icon;
            const cfg = w.configuration ?? {};
            return (
              <Card key={w.id} className="transition-shadow hover:shadow-soft">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{w.name}</h3>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                    <Switch
                      checked={w.is_active}
                      onCheckedChange={() => toggleMutation.mutate(w)}
                    />
                  </div>
                  <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                    {w.content_type === "weather" && (
                      <p>Cidade: <span className="text-foreground">{cfg.city ?? "—"}</span></p>
                    )}
                    {w.content_type === "news" && (
                      <p>Categoria: <span className="text-foreground">{cfg.category ?? "—"}</span></p>
                    )}
                    {w.content_type === "ticker" && (
                      <p className="line-clamp-2">"{cfg.text ?? "—"}"</p>
                    )}
                    {w.content_type === "html" && (
                      <p>HTML personalizado ({String(cfg.html ?? "").length} caracteres)</p>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(w.id)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo widget</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return toast.error("Informe um nome");
              saveMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Clima São Paulo"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.content_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, content_type: v as ContentType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weather">🌤️ Clima</SelectItem>
                  <SelectItem value="news">📰 Notícias</SelectItem>
                  <SelectItem value="ticker">📝 Ticker (Letreiro)</SelectItem>
                  <SelectItem value="html">💻 HTML Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.content_type === "weather" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Select
                    value={form.city}
                    onValueChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_CITIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Atualizar a cada (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={form.weatherInterval}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, weatherInterval: +e.target.value || 30 }))
                    }
                  />
                </div>
              </div>
            )}

            {form.content_type === "news" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.newsCategory}
                    onValueChange={(v) => setForm((f) => ({ ...f, newsCategory: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Geral</SelectItem>
                      <SelectItem value="business">Negócios</SelectItem>
                      <SelectItem value="technology">Tecnologia</SelectItem>
                      <SelectItem value="sports">Esportes</SelectItem>
                      <SelectItem value="entertainment">Entretenimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Atualizar a cada (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={form.newsInterval}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, newsInterval: +e.target.value || 60 }))
                    }
                  />
                </div>
              </div>
            )}

            {form.content_type === "ticker" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Texto do ticker</Label>
                  <Textarea
                    rows={3}
                    value={form.tickerText}
                    onChange={(e) => setForm((f) => ({ ...f, tickerText: e.target.value }))}
                    placeholder="Promoção imperdível! Confira nossas ofertas..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Velocidade ({form.tickerSpeed}px/s)</Label>
                  <Input
                    type="range"
                    min={20}
                    max={150}
                    value={form.tickerSpeed}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tickerSpeed: +e.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {form.content_type === "html" && (
              <div className="space-y-2">
                <Label>HTML personalizado</Label>
                <Textarea
                  rows={6}
                  value={form.html}
                  onChange={(e) => setForm((f) => ({ ...f, html: e.target.value }))}
                  placeholder="<div>Seu HTML aqui</div>"
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <Label>Ativo</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
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
            <AlertDialogTitle>Excluir este widget?</AlertDialogTitle>
            <AlertDialogDescription>
              O widget será removido e não aparecerá mais nas playlists.
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
    </>
  );
}
