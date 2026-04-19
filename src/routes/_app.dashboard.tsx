import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  MonitorPlay,
  ListMusic,
  Megaphone,
  Wifi,
  WifiOff,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader, LoadingState } from "@/components/page-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Loopin TV" }] }),
});

interface ScreenRow {
  id: string;
  name: string;
  status: string | null;
  last_ping: string | null;
  locations?: { name: string } | null;
}

function isOnline(lastPing: string | null) {
  if (!lastPing) return false;
  return Date.now() - new Date(lastPing).getTime() < 2 * 60 * 1000;
}

function DashboardPage() {
  const { user } = useAuth();
  const userId = user!.id;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: async () => {
      const [screens, playlists, campaigns] = await Promise.all([
        supabase
          .from("screens")
          .select("id, name, status, last_ping, locations(name)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("playlists").select("id").eq("user_id", userId),
        supabase
          .from("campaigns")
          .select("id, status")
          .eq("user_id", userId),
      ]);
      return {
        screens: (screens.data ?? []) as unknown as ScreenRow[],
        playlistsCount: playlists.data?.length ?? 0,
        campaigns: campaigns.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Visão geral da sua operação"
          icon={LayoutDashboard}
        />
        <LoadingState />
      </>
    );
  }

  const onlineCount = data.screens.filter((s) => isOnline(s.last_ping)).length;
  const offlineCount = data.screens.length - onlineCount;
  const activeCampaigns = data.campaigns.filter((c) => c.status === "active").length;

  const kpis = [
    {
      label: "Telas online",
      value: onlineCount,
      hint: `${data.screens.length} no total`,
      icon: Wifi,
      tone: "success" as const,
    },
    {
      label: "Telas offline",
      value: offlineCount,
      hint: "Verifique conexão",
      icon: WifiOff,
      tone: "warning" as const,
    },
    {
      label: "Playlists",
      value: data.playlistsCount,
      hint: "Conteúdos salvos",
      icon: ListMusic,
      tone: "default" as const,
    },
    {
      label: "Campanhas ativas",
      value: activeCampaigns,
      hint: `${data.campaigns.length} no total`,
      icon: Megaphone,
      tone: "default" as const,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Olá, ${user?.email?.split("@")[0]} 👋`}
        description="Aqui está o resumo da sua operação Loopin TV."
        icon={LayoutDashboard}
        action={
          <Button asChild>
            <Link to="/screens">
              <Plus className="mr-2 h-4 w-4" /> Adicionar tela
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {k.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    {k.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
                </div>
                <div
                  className={
                    "flex h-10 w-10 items-center justify-center rounded-lg " +
                    (k.tone === "success"
                      ? "bg-success/15 text-success"
                      : k.tone === "warning"
                        ? "bg-warning/20 text-warning-foreground"
                        : "bg-primary/10 text-primary")
                  }
                >
                  <k.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Status das telas</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/screens">
                Ver tudo <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.screens.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Nenhuma tela cadastrada. Crie sua primeira tela em{" "}
                <Link to="/screens" className="text-primary hover:underline">
                  Telas
                </Link>
                .
              </div>
            ) : (
              <ul className="divide-y">
                {data.screens.slice(0, 6).map((s) => {
                  const online = isOnline(s.last_ping);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-6 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={
                            "h-2.5 w-2.5 shrink-0 rounded-full " +
                            (online ? "bg-success" : "bg-muted-foreground/40")
                          }
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {s.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.locations?.name ?? "Sem local"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={online ? "default" : "secondary"}>
                        {online ? "Online" : "Offline"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atalhos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink to="/screens" icon={MonitorPlay} label="Adicionar tela" />
            <QuickLink to="/playlists" icon={ListMusic} label="Nova playlist" />
            <QuickLink to="/campaigns" icon={Megaphone} label="Criar campanha" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/screens" | "/playlists" | "/campaigns";
  icon: typeof MonitorPlay;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
