import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, Download, Calendar, Play, Monitor, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader, EmptyState, LoadingState } from "@/components/page-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Relatórios — Loopin TV" }] }),
});

interface PlayLog {
  id: string;
  screen_id: string | null;
  campaign_id: string | null;
  played_at: string;
  duration_seconds: number | null;
  screens?: { name: string | null } | null;
  campaigns?: { name: string | null; advertisers?: { name: string | null } | null } | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function ReportsPage() {
  const { user } = useAuth();
  const userId = user!.id;

  const [start, setStart] = useState(daysAgoISO(7));
  const [end, setEnd] = useState(todayISO());
  const [screenFilter, setScreenFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  const screensQuery = useQuery({
    queryKey: ["screens-list", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screens")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns-list", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const logsQuery = useQuery({
    queryKey: ["play-logs", userId, start, end, screenFilter, campaignFilter],
    queryFn: async () => {
      let q = supabase
        .from("playback_logs")
        .select(
          "id, screen_id, campaign_id, played_at, duration_seconds, screens(name), campaigns(name, advertisers(name))",
        )
        .eq("user_id", userId)
        .gte("played_at", `${start}T00:00:00`)
        .lte("played_at", `${end}T23:59:59`)
        .order("played_at", { ascending: false })
        .limit(1000);
      if (screenFilter !== "all") q = q.eq("screen_id", screenFilter);
      if (campaignFilter !== "all") q = q.eq("campaign_id", campaignFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PlayLog[];
    },
  });

  const summary = useMemo(() => {
    const logs = logsQuery.data ?? [];
    const totalPlays = logs.length;
    const totalSeconds = logs.reduce(
      (s, l) => s + (l.duration_seconds ?? 0),
      0,
    );
    const byCampaign = new Map<string, { name: string; plays: number; seconds: number }>();
    const byScreen = new Map<string, { name: string; plays: number }>();
    logs.forEach((l) => {
      const cKey = l.campaign_id ?? "unknown";
      const cName = l.campaigns?.name ?? "Sem campanha";
      const c = byCampaign.get(cKey) ?? { name: cName, plays: 0, seconds: 0 };
      c.plays++;
      c.seconds += l.duration_seconds ?? 0;
      byCampaign.set(cKey, c);

      const sKey = l.screen_id ?? "unknown";
      const sName = l.screens?.name ?? "Sem tela";
      const s = byScreen.get(sKey) ?? { name: sName, plays: 0 };
      s.plays++;
      byScreen.set(sKey, s);
    });
    return {
      totalPlays,
      totalSeconds,
      campaigns: [...byCampaign.values()].sort((a, b) => b.plays - a.plays),
      screens: [...byScreen.values()].sort((a, b) => b.plays - a.plays),
    };
  }, [logsQuery.data]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  };

  const exportCSV = () => {
    const logs = logsQuery.data ?? [];
    if (!logs.length) {
      toast.error("Sem dados para exportar");
      return;
    }
    const header = ["Data/Hora", "Tela", "Campanha", "Anunciante", "Duração (s)"];
    const rows = logs.map((l) => [
      new Date(l.played_at).toLocaleString("pt-BR"),
      l.screens?.name ?? "",
      l.campaigns?.name ?? "",
      l.campaigns?.advertisers?.name ?? "",
      String(l.duration_seconds ?? 0),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loopin-relatorio-${start}_a_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const logs = logsQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Veja o que, onde e quando as suas mídias foram exibidas."
        icon={BarChart3}
        action={
          <Button onClick={exportCSV} disabled={!logs.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="start">De</Label>
            <Input
              id="start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">Até</Label>
            <Input
              id="end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tela</Label>
            <Select value={screenFilter} onValueChange={setScreenFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as telas</SelectItem>
                {(screensQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {(campaignsQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {logsQuery.isLoading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sem exibições no período"
          description="Ajuste o período ou os filtros. Os registros chegam conforme as telas tocam as campanhas."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Play}
              label="Exibições"
              value={summary.totalPlays.toLocaleString("pt-BR")}
            />
            <StatCard
              icon={Calendar}
              label="Tempo total"
              value={formatDuration(summary.totalSeconds)}
            />
            <StatCard
              icon={Monitor}
              label="Telas ativas"
              value={String(summary.screens.length)}
            />
            <StatCard
              icon={Building2}
              label="Campanhas exibidas"
              value={String(summary.campaigns.length)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold">
                  Top campanhas por exibição
                </h3>
                <div className="space-y-2">
                  {summary.campaigns.slice(0, 6).map((c) => {
                    const pct =
                      summary.totalPlays > 0
                        ? (c.plays / summary.totalPlays) * 100
                        : 0;
                    return (
                      <div key={c.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{c.name}</span>
                          <span className="text-muted-foreground">
                            {c.plays}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold">
                  Top telas por exibição
                </h3>
                <div className="space-y-2">
                  {summary.screens.slice(0, 6).map((s) => {
                    const pct =
                      summary.totalPlays > 0
                        ? (s.plays / summary.totalPlays) * 100
                        : 0;
                    return (
                      <div key={s.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{s.name}</span>
                          <span className="text-muted-foreground">
                            {s.plays}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b p-4">
                <h3 className="text-sm font-semibold">
                  Histórico detalhado
                </h3>
                <Badge variant="secondary">
                  {logs.length} {logs.length === 1 ? "registro" : "registros"}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tela</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Anunciante</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.slice(0, 100).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(l.played_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{l.screens?.name ?? "—"}</TableCell>
                        <TableCell>{l.campaigns?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {l.campaigns?.advertisers?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {l.duration_seconds ?? 0}s
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {logs.length > 100 && (
                <div className="border-t p-3 text-center text-xs text-muted-foreground">
                  Exibindo 100 de {logs.length}. Exporte o CSV para ver tudo.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Play;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
