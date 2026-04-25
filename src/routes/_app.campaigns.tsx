import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import {
  Megaphone,
  Plus,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Check,
  Upload,
  Image as ImageIcon,
  Calendar,
  Building2,
  Loader2,
  Video,
  
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase, uploadToWorker } from "@/lib/supabase";
import { transcodeVideoFor720p } from "@/lib/video-transcode";
import { Progress } from "@/components/ui/progress";
import { PageHeader, EmptyState, LoadingState } from "@/components/page-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/campaigns")({
  component: CampaignsPage,
  head: () => ({ meta: [{ title: "Campanhas — Loopin TV" }] }),
});

interface Campaign {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_seconds: number | null;
  media_url: string | null;
  advertiser_id: string | null;
  advertisers?: { name: string } | null;
}

const STEPS = ["Anunciante", "Mídia", "Detalhes", "Agenda"] as const;
type StepIndex = 0 | 1 | 2 | 3;

interface WizardData {
  advertiser_id: string;
  newAdvertiserName: string;
  file: File | null;
  previewUrl: string | null;
  isVideo: boolean;
  name: string;
  duration_seconds: number;
  start_date: string;
  end_date: string;
}

const initialWizard: WizardData = {
  advertiser_id: "",
  newAdvertiserName: "",
  file: null,
  previewUrl: null,
  isVideo: false,
  name: "",
  duration_seconds: 15,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
};

function CampaignsPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<StepIndex>(0);
  const [data, setData] = useState<WizardData>(initialWizard);
  const [submitting, setSubmitting] = useState(false);
  const [transcodeStatus, setTranscodeStatus] = useState<{
    active: boolean;
    phase: "loading" | "transcoding" | "finalizing" | "uploading";
    progress: number;
  }>({ active: false, phase: "loading", progress: 0 });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; isVideo: boolean; name: string } | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    advertiser_id: "",
    status: "active" as "active" | "paused" | "completed",
    start_date: "",
    end_date: "",
    duration_seconds: 15,
  });

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setEditForm({
      name: c.name ?? "",
      advertiser_id: c.advertiser_id ?? "",
      status: ((c.status as "active" | "paused" | "completed") ?? "active"),
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      duration_seconds: c.duration_seconds ?? 15,
    });
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("campaigns")
        .update({
          name: editForm.name.trim(),
          advertiser_id: editForm.advertiser_id || null,
          status: editForm.status,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
          duration_seconds: editForm.duration_seconds,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", userId] });
      toast.success("Campanha atualizada");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, advertisers(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });

  const advertisersQuery = useQuery({
    queryKey: ["advertisers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisers")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", userId] });
      toast.success("Campanha excluída");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetWizard = () => {
    setStep(0);
    setData(initialWizard);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    resetWizard();
  };

  const acceptFile = (f: File) => {
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      toast.error("Use uma imagem ou vídeo");
      return;
    }
    const isVideo = f.type.startsWith("video/");
    const previewUrl = URL.createObjectURL(f);

    setData((d) => ({
      ...d,
      file: f,
      previewUrl,
      isVideo,
      name: d.name || f.name.replace(/\.[^.]+$/, ""),
    }));

    // Para vídeo: lê a duração real do arquivo automaticamente
    if (isVideo) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = previewUrl;
      v.onloadedmetadata = () => {
        const secs = Math.max(1, Math.round(v.duration || 0));
        if (secs > 0) {
          setData((d) => ({ ...d, duration_seconds: secs }));
        }
      };
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const canAdvance = (): boolean => {
    if (step === 0) return !!data.advertiser_id || !!data.newAdvertiserName.trim();
    if (step === 1) return !!data.file;
    if (step === 2) return !!data.name.trim() && data.duration_seconds > 0;
    if (step === 3) return !!data.start_date && !!data.end_date;
    return false;
  };

  const submitCampaign = async () => {
    setSubmitting(true);
    try {
      let advertiserId = data.advertiser_id;
      if (!advertiserId && data.newAdvertiserName.trim()) {
        const { data: created, error } = await supabase
          .from("advertisers")
          .insert({ user_id: userId, name: data.newAdvertiserName.trim() })
          .select("id")
          .single();
        if (error) throw error;
        advertiserId = created.id;
      }

      // Otimização: se for vídeo, converte para MP4 H.264 720p (~1.5 Mbps)
      // antes do upload, para rodar suave em TV Box mais fracas.
      let fileToUpload = data.file!;
      if (fileToUpload.type.startsWith("video/")) {
        try {
          setTranscodeStatus({ active: true, phase: "loading", progress: 0 });
          const optimized = await transcodeVideoFor720p(fileToUpload, (info) => {
            setTranscodeStatus({ active: true, ...info });
          });
          fileToUpload = optimized;
        } catch (err) {
          console.error("Falha na otimização do vídeo:", err);
          toast.warning(
            "Não foi possível otimizar o vídeo neste navegador. Enviando o arquivo original.",
          );
        }
      }

      setTranscodeStatus({ active: true, phase: "uploading", progress: 0 });
      const url = await uploadToWorker(fileToUpload);

      const { error: insertErr } = await supabase.from("campaigns").insert({
        user_id: userId,
        advertiser_id: advertiserId || null,
        name: data.name.trim(),
        media_url: url,
        
        start_date: data.start_date,
        end_date: data.end_date,
        duration_seconds: data.duration_seconds,
        status: "active",
      });
      if (insertErr) throw insertErr;

      qc.invalidateQueries({ queryKey: ["campaigns", userId] });
      qc.invalidateQueries({ queryKey: ["advertisers", userId] });
      toast.success("Campanha criada com sucesso!");
      closeWizard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar campanha");
    } finally {
      setSubmitting(false);
      setTranscodeStatus({ active: false, phase: "loading", progress: 0 });
    }
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("pt-BR") : "—";

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Crie campanhas em 4 passos guiados — sem complicação."
        icon={Megaphone}
        action={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova campanha
          </Button>
        }
      />

      {campaignsQuery.isLoading ? (
        <LoadingState />
      ) : (campaignsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha ainda"
          description="Use o assistente em 4 passos para subir sua primeira mídia e agendar a exibição."
          actionLabel="Criar primeira campanha"
          onAction={() => setWizardOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(campaignsQuery.data ?? []).map((c) => {
            const isVideo = c.media_url ? /\.(mp4|webm|mov)$/i.test(c.media_url) : false;
            return (
            <Card key={c.id} className="overflow-hidden transition-shadow hover:shadow-soft">
              {c.media_url && (
                <button
                  type="button"
                  onClick={() =>
                    setPreviewMedia({ url: c.media_url!, isVideo, name: c.name })
                  }
                  className="group relative hidden aspect-video w-full overflow-hidden bg-muted sm:block"
                  aria-label={`Abrir ${isVideo ? "vídeo" : "imagem"} de ${c.name}`}
                >
                  {isVideo ? (
                    <video src={c.media_url} className="h-full w-full object-cover" muted />
                  ) : (
                    <img
                      src={c.media_url}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {isVideo ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <ImageIcon className="h-5 w-5" />
                      )}
                    </span>
                  </span>
                </button>
              )}
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.advertisers?.name ?? "Sem anunciante"}
                    </p>
                  </div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"}>
                    {c.status === "active" ? "Ativa" : c.status ?? "—"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block font-medium text-foreground">
                      {fmtDate(c.start_date)}
                    </span>
                    Início
                  </div>
                  <div>
                    <span className="block font-medium text-foreground">
                      {fmtDate(c.end_date)}
                    </span>
                    Fim
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  {c.media_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sm:hidden"
                      onClick={() =>
                        setPreviewMedia({ url: c.media_url!, isVideo, name: c.name })
                      }
                      aria-label="Ver mídia"
                    >
                      {isVideo ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <span className="sm:hidden" />
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Wizard */}
      <Dialog open={wizardOpen} onOpenChange={(o) => (o ? setWizardOpen(true) : closeWizard())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" /> Nova campanha
            </DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <ol className="my-4 flex items-center justify-between gap-2">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      done
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-primary/15 text-primary ring-2 ring-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:inline",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="mx-1 h-px flex-1 bg-border" />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="min-h-[260px]">
            {step === 0 && (
              <div className="space-y-4">
                <StepIntro
                  icon={Building2}
                  title="Quem é o anunciante?"
                  description="Selecione um existente ou crie um novo."
                />
                <div className="space-y-2">
                  <Label>Anunciante existente</Label>
                  <Select
                    value={data.advertiser_id}
                    onValueChange={(v) =>
                      setData((d) => ({ ...d, advertiser_id: v, newAdvertiserName: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(advertisersQuery.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                      {(advertisersQuery.data ?? []).length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum anunciante cadastrado
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-center text-xs uppercase tracking-wider text-muted-foreground">
                  ou
                </div>
                <div className="space-y-2">
                  <Label>Criar novo anunciante</Label>
                  <Input
                    placeholder="Ex.: Coca-Cola Brasil"
                    value={data.newAdvertiserName}
                    onChange={(e) =>
                      setData((d) => ({
                        ...d,
                        newAdvertiserName: e.target.value,
                        advertiser_id: "",
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <StepIntro
                  icon={ImageIcon}
                  title="Envie a mídia"
                  description="Imagem (JPG/PNG) ou vídeo (MP4). Será armazenada com segurança."
                />
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/30 p-10 text-center transition-colors hover:border-primary hover:bg-primary/5"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={handleDrop}
                >
                  {data.previewUrl ? (
                    data.isVideo ? (
                      <video
                        src={data.previewUrl}
                        className="max-h-48 rounded-lg"
                        controls
                      />
                    ) : (
                      <img
                        src={data.previewUrl}
                        alt="Prévia"
                        className="max-h-48 rounded-lg"
                      />
                    )
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Clique para escolher um arquivo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ou arraste aqui
                        </p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFile}
                  />
                </label>
                {data.file && (
                  <p className="text-center text-xs text-muted-foreground">
                    {data.file.name} · {(data.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <StepIntro
                  icon={Pencil}
                  title="Detalhes da campanha"
                  description={
                    data.isVideo
                      ? "Defina o nome da campanha. A duração foi detectada do vídeo."
                      : "Defina nome e tempo de exibição por loop."
                  }
                />
                <div className="space-y-2">
                  <Label>Nome da campanha</Label>
                  <Input
                    value={data.name}
                    onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Ex.: Promoção de Verão"
                  />
                </div>
                {data.isVideo ? (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Duração detectada do vídeo:{" "}
                    <strong className="text-foreground">
                      {data.duration_seconds}s
                    </strong>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Duração (segundos)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={data.duration_seconds}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          duration_seconds: parseInt(e.target.value || "0"),
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <StepIntro
                  icon={Calendar}
                  title="Quando exibir?"
                  description="Defina o período em que esta campanha estará no ar."
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input
                      type="date"
                      value={data.start_date}
                      onChange={(e) =>
                        setData((d) => ({ ...d, start_date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Término</Label>
                    <Input
                      type="date"
                      value={data.end_date}
                      onChange={(e) =>
                        setData((d) => ({ ...d, end_date: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Resumo</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>
                      <strong className="text-foreground">Anunciante:</strong>{" "}
                      {data.newAdvertiserName ||
                        advertisersQuery.data?.find((a) => a.id === data.advertiser_id)
                          ?.name}
                    </li>
                    <li>
                      <strong className="text-foreground">Mídia:</strong>{" "}
                      {data.file?.name}
                    </li>
                    <li>
                      <strong className="text-foreground">Nome:</strong> {data.name}
                    </li>
                    <li>
                      <strong className="text-foreground">Duração:</strong>{" "}
                      {data.duration_seconds}s
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {transcodeStatus.active && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {transcodeStatus.phase === "loading" && "Carregando otimizador…"}
                  {transcodeStatus.phase === "transcoding" && "Otimizando vídeo para 720p…"}
                  {transcodeStatus.phase === "finalizing" && "Finalizando otimização…"}
                  {transcodeStatus.phase === "uploading" && "Enviando para o servidor…"}
                </span>
                {transcodeStatus.phase === "transcoding" && (
                  <span className="tabular-nums text-muted-foreground">
                    {Math.round(transcodeStatus.progress * 100)}%
                  </span>
                )}
              </div>
              <Progress
                value={
                  transcodeStatus.phase === "uploading"
                    ? undefined
                    : transcodeStatus.progress * 100
                }
                className="h-1.5"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Convertendo para MP4 H.264 720p (~1.5 Mbps) — ideal para TV Box.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1) as StepIndex)}
              disabled={step === 0 || submitting}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <span className="text-xs text-muted-foreground">
              Passo {step + 1} de {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() =>
                  canAdvance()
                    ? setStep((s) => (s + 1) as StepIndex)
                    : toast.error("Preencha esta etapa")
                }
              >
                Avançar <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submitCampaign} disabled={!canAdvance() || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando…
                  </>
                ) : (
                  "Criar campanha"
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
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

      <Dialog open={!!previewMedia} onOpenChange={(o) => !o && setPreviewMedia(null)}>
        <DialogContent className="max-w-[95vw] border-0 bg-black p-0 sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewMedia?.name ?? "Mídia"}</DialogTitle>
          </DialogHeader>
          {previewMedia && (
            <div className="flex max-h-[85vh] w-full items-center justify-center">
              {previewMedia.isVideo ? (
                <video
                  src={previewMedia.url}
                  className="max-h-[85vh] w-full"
                  controls
                  autoPlay
                />
              ) : (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.name}
                  className="max-h-[85vh] w-full object-contain"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Campaign */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar campanha</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editForm.name.trim()) return toast.error("Informe o nome");
              editMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Anunciante</Label>
              <Select
                value={editForm.advertiser_id}
                onValueChange={(v) => setEditForm((f) => ({ ...f, advertiser_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {(advertisersQuery.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm((f) => ({ ...f, status: v as typeof f.status }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(v) =>
                    setEditForm((f) => ({ ...f, priority: v as typeof f.priority }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">🥇 Ouro</SelectItem>
                    <SelectItem value="silver">🥈 Prata</SelectItem>
                    <SelectItem value="bronze">🥉 Bronze</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Término</Label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duração (segundos)</Label>
              <Input
                type="number"
                min={1}
                value={editForm.duration_seconds}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    duration_seconds: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepIntro({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Megaphone;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
