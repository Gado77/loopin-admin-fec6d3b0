import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Camera,
  FileText,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DiagnosticsScreen {
  id: string;
  name: string;
  device_id: string | null;
  orientation: string | null;
  last_ping: string | null;
  is_paused?: boolean | null;
  current_content?: string | null;
  playlist_items_count?: number | null;
  cache_used_mb?: number | null;
  locations?: { name: string } | null;
  playlists?: { name: string } | null;
}

interface PlayerLog {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
}

const ORIENTATION_LABEL: Record<string, string> = {
  landscape: "Horizontal",
  portrait: "Vertical",
  landscape_inverted: "Horizontal invertida",
  portrait_inverted: "Vertical invertida",
};

const CACHE_LIMIT_MB = 500;

function isOnline(lastPing: string | null) {
  return !!lastPing && Date.now() - new Date(lastPing).getTime() < 2 * 60 * 1000;
}

function formatRelative(dt: string | null) {
  if (!dt) return "—";
  const diff = Math.max(0, Date.now() - new Date(dt).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(dt).toLocaleString("pt-BR");
}

interface Props {
  screen: DiagnosticsScreen | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenDiagnosticsDialog({ screen, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [logsOpen, setLogsOpen] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotStatus, setScreenshotStatus] = useState<
    "idle" | "waiting" | "ready"
  >("idle");
  const [pendingCmd, setPendingCmd] = useState<string | null>(null);
  const [localPaused, setLocalPaused] = useState<boolean | null>(null);
  const screenshotPollRef = useRef<number | null>(null);
  const lastShotAtRef = useRef<number>(0);

  // Reset state when dialog closes / screen changes
  useEffect(() => {
    if (!open) {
      setScreenshotUrl(null);
      setScreenshotStatus("idle");
      setLogsOpen(false);
      setLocalPaused(null);
      if (screenshotPollRef.current) {
        clearInterval(screenshotPollRef.current);
        screenshotPollRef.current = null;
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      if (screenshotPollRef.current) clearInterval(screenshotPollRef.current);
    },
    [],
  );

  const online = screen ? isOnline(screen.last_ping) : false;
  const isPaused = localPaused ?? !!screen?.is_paused;
  const cacheUsed = screen?.cache_used_mb ?? 0;
  const cachePct = Math.min(100, Math.round((cacheUsed / CACHE_LIMIT_MB) * 100));

  const sendCommand = async (command: string, payload = "") => {
    if (!screen) return;
    setPendingCmd(command);
    try {
      const { error } = await supabase.from("screen_commands").insert({
        screen_id: screen.id,
        command,
        payload,
        status: "pending",
      });
      if (error) throw error;
      toast.success(
        `Comando enviado. A TV recebe em até 30s.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar comando");
    } finally {
      setPendingCmd(null);
    }
  };

  const handleTogglePause = async () => {
    if (!screen) return;
    const cmd = isPaused ? "resume" : "pause";
    await sendCommand(cmd);
    // Alterna localmente para feedback imediato — o player atualiza o estado real.
    setLocalPaused(!isPaused);
    qc.invalidateQueries({ queryKey: ["screens"] });
  };

  const handleScreenshot = async () => {
    if (!screen) return;
    lastShotAtRef.current = Date.now();
    setScreenshotUrl(null);
    setScreenshotStatus("waiting");
    await sendCommand("screenshot");
    if (screenshotPollRef.current) clearInterval(screenshotPollRef.current);
    screenshotPollRef.current = window.setInterval(checkForScreenshot, 4000);
    // primeira checagem em 5s
    window.setTimeout(checkForScreenshot, 5000);
  };

  const checkForScreenshot = async () => {
    if (!screen) return;
    try {
      const { data: logs, error } = await supabase
        .from("player_logs")
        .select("*")
        .eq("screen_id", screen.id)
        .eq("event_type", "screenshot_taken")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (logs && logs.length > 0) {
        const latest = logs[0] as PlayerLog;
        const created = new Date(latest.created_at).getTime();
        if (created < lastShotAtRef.current - 2000) return; // ignora antigos
        const msg = latest.message || "";
        const urlMatch = msg.match(/https?:\/\/[^\s]+\.(png|jpg|jpeg)/i);
        if (urlMatch) {
          setScreenshotUrl(`${urlMatch[0]}?t=${Date.now()}`);
          setScreenshotStatus("ready");
          if (screenshotPollRef.current) {
            clearInterval(screenshotPollRef.current);
            screenshotPollRef.current = null;
          }
        }
      }
    } catch (e) {
      console.error("Erro ao verificar screenshot:", e);
    }
  };

  // Logs query
  const logsQuery = useQuery({
    queryKey: ["player-logs", screen?.id],
    enabled: logsOpen && !!screen?.id,
    refetchInterval: logsOpen ? 5000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_logs")
        .select("id, event_type, message, created_at")
        .eq("screen_id", screen!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PlayerLog[];
    },
  });

  if (!screen) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Diagnóstico da tela
            </DialogTitle>
          </DialogHeader>

          {/* Header card */}
          <div className="rounded-xl bg-gradient-to-br from-foreground to-foreground/80 p-4 text-background">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold">{screen.name}</h3>
              <Badge
                variant={online ? "default" : "secondary"}
                className={cn(
                  "shrink-0",
                  online
                    ? "bg-green-500 text-white hover:bg-green-500"
                    : "bg-red-500 text-white hover:bg-red-500",
                )}
              >
                {online ? (
                  <Wifi className="mr-1 h-3 w-3" />
                ) : (
                  <WifiOff className="mr-1 h-3 w-3" />
                )}
                {online ? "Online" : "Offline"}
              </Badge>
            </div>
            <p className="mt-2 rounded-md bg-black/30 px-2 py-1 font-mono text-xs">
              {screen.device_id || "PENDENTE"}
            </p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Última atividade" value={formatRelative(screen.last_ping)} />
            <InfoCard
              label="Orientação"
              value={ORIENTATION_LABEL[screen.orientation ?? "landscape"] ?? "—"}
            />
            <InfoCard label="Local" value={screen.locations?.name ?? "—"} className="col-span-2" />
            <InfoCard
              label="Playlist ativa"
              value={screen.playlists?.name ?? "Nenhuma"}
              className="col-span-2"
            />
            <InfoCard
              label="Reproduzindo agora"
              value={screen.current_content ?? "Aguardando…"}
              highlight
              className="col-span-2"
            />
            <InfoCard
              label="Itens na playlist"
              value={
                screen.playlist_items_count != null
                  ? `${screen.playlist_items_count}`
                  : "0"
              }
            />
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Cache
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${cachePct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {cacheUsed} MB / {CACHE_LIMIT_MB} MB
              </p>
            </div>
          </div>

          {/* Action grid */}
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              icon={RotateCw}
              label="Reiniciar app"
              onClick={() => sendCommand("restart")}
              loading={pendingCmd === "restart"}
            />
            <ActionButton
              icon={isPaused ? Play : Pause}
              label={isPaused ? "Retomar" : "Pausar"}
              onClick={handleTogglePause}
              loading={pendingCmd === "pause" || pendingCmd === "resume"}
              variant={isPaused ? "default" : "outline"}
            />
            <ActionButton
              icon={Camera}
              label="Tirar screenshot"
              onClick={handleScreenshot}
              loading={pendingCmd === "screenshot" || screenshotStatus === "waiting"}
            />
            <ActionButton
              icon={FileText}
              label="Ver logs"
              onClick={() => setLogsOpen(true)}
            />
          </div>

          {/* Screenshot preview */}
          {screenshotStatus !== "idle" && (
            <div className="rounded-xl border bg-muted/30 p-3 text-center">
              {screenshotStatus === "waiting" && (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-xs">Processando screenshot na TV…</p>
                </div>
              )}
              {screenshotStatus === "ready" && screenshotUrl && (
                <>
                  <img
                    src={screenshotUrl}
                    alt="Screenshot"
                    className="mx-auto max-h-64 rounded-lg border"
                  />
                  <p className="mt-2 text-xs text-green-600">
                    📸 Screenshot capturado!
                  </p>
                </>
              )}
            </div>
          )}

          {/* Force refresh */}
          <Button
            className="w-full"
            onClick={() => sendCommand("refresh", "force")}
            disabled={pendingCmd === "refresh"}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                pendingCmd === "refresh" && "animate-spin",
              )}
            />
            Forçar atualização
          </Button>
        </DialogContent>
      </Dialog>

      {/* Logs dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b p-4">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" /> Logs do player ·{" "}
              <span className="text-muted-foreground">{screen.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
            {logsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando logs…
              </div>
            ) : (logsQuery.data ?? []).length === 0 ? (
              <p className="py-10 text-center text-zinc-500">
                Nenhum log encontrado para esta tela.
              </p>
            ) : (
              <ul className="space-y-1">
                {logsQuery.data!.map((log) => {
                  const time = new Date(log.created_at).toLocaleTimeString(
                    "pt-BR",
                  );
                  const t = log.event_type || "";
                  const color = t.includes("error")
                    ? "text-red-400"
                    : t.includes("start")
                      ? "text-green-400"
                      : t.includes("command")
                        ? "text-blue-400"
                        : "text-zinc-400";
                  return (
                    <li key={log.id} className="flex gap-2 leading-relaxed">
                      <span className="shrink-0 text-zinc-500">{time}</span>
                      <span className={cn("shrink-0 font-semibold", color)}>
                        [{t}]
                      </span>
                      <span className="break-all text-zinc-200">
                        {log.message}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <p className="text-xs text-muted-foreground">
              Atualiza automaticamente a cada 5s.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => logsQuery.refetch()}
              disabled={logsQuery.isFetching}
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 h-3.5 w-3.5",
                  logsQuery.isFetching && "animate-spin",
                )}
              />
              Atualizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoCard({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        highlight && "border-primary/30 bg-primary/5",
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold",
          highlight && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  loading,
  variant = "outline",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      disabled={loading}
      className="h-auto justify-start gap-2 py-3"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span className="text-sm">{label}</span>
    </Button>
  );
}
