import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  User2,
  Building,
  Cloud,
  Lock,
  Eye,
  EyeOff,
  Trash,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/page-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — Loopin TV" }] }),
});

interface SettingsRow {
  id: string;
  user_id: string;
  organization_name: string | null;
  organization_logo_url: string | null;
  api_weather_key: string | null;
  api_news_key: string | null;
}

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH = [
  { label: "Muito fraca", color: "bg-red-500", w: "20%" },
  { label: "Fraca", color: "bg-orange-500", w: "40%" },
  { label: "Regular", color: "bg-yellow-500", w: "60%" },
  { label: "Forte", color: "bg-green-500", w: "80%" },
  { label: "Muito forte", color: "bg-emerald-500", w: "100%" },
];

function SettingsPage() {
  const { user, signOut } = useAuth();
  const userId = user!.id;
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as SettingsRow | null;
    },
  });

  // Org form
  const [orgName, setOrgName] = useState("");
  const [orgLogo, setOrgLogo] = useState("");
  // APIs
  const [weatherKey, setWeatherKey] = useState("");
  const [weatherTest, setWeatherTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  // Password
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const s = settingsQuery.data;
    if (s) {
      setOrgName(s.organization_name ?? "");
      setOrgLogo(s.organization_logo_url ?? "");
      setWeatherKey(s.api_weather_key ?? "");
    }
  }, [settingsQuery.data]);

  const upsertSettings = useMutation({
    mutationFn: async (patch: Partial<SettingsRow>) => {
      const existing = settingsQuery.data;
      if (existing) {
        const { error } = await supabase
          .from("settings")
          .update(patch)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("settings").insert({
          user_id: userId,
          ...patch,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", userId] });
      toast.success("Salvo com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async (pw: string) => {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPw("");
      setConfirmPw("");
      toast.success("Senha alterada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function testWeather() {
    if (!weatherKey.trim()) {
      toast.error("Cole sua chave antes de testar");
      return;
    }
    setTesting(true);
    setWeatherTest(null);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Sao+Paulo,BR&appid=${weatherKey.trim()}`,
      );
      const data = await res.json();
      if (res.ok) {
        setWeatherTest({ ok: true, msg: "✓ Conexão bem-sucedida! API funcionando." });
      } else {
        setWeatherTest({
          ok: false,
          msg: `✗ Erro: ${data.message ?? "Chave inválida"}`,
        });
      }
    } catch {
      setWeatherTest({ ok: false, msg: "✗ Erro de conexão. Verifique sua internet." });
    } finally {
      setTesting(false);
    }
  }

  function clearCache() {
    if (!confirm("Limpar cache do navegador?")) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }
      if (typeof caches !== "undefined") {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
      }
      toast.success("Cache limpo. Recarregando…");
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error("Não foi possível limpar o cache");
    }
  }

  const themes = [
    { id: "light" as const, label: "Claro", icon: Sun },
    { id: "dark" as const, label: "Escuro", icon: Moon },
    { id: "system" as const, label: "Sistema", icon: Laptop },
  ];

  const score = passwordScore(newPw);
  const strength = STRENGTH[score];

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Personalize sua organização, integrações, segurança e aparência."
        icon={SettingsIcon}
      />

      <Tabs defaultValue="organization" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-3 sm:grid-cols-5">
          <TabsTrigger value="organization">
            <Building className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Organização</span>
          </TabsTrigger>
          <TabsTrigger value="apis">
            <Cloud className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">APIs</span>
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Senha</span>
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Sun className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="account">
            <User2 className="mr-1.5 h-4 w-4" /> <span className="hidden sm:inline">Conta</span>
          </TabsTrigger>
        </TabsList>

        {/* ORGANIZATION */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Sua organização</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!orgName.trim()) return toast.error("Informe o nome da organização");
                  upsertSettings.mutate({
                    organization_name: orgName.trim(),
                    organization_logo_url: orgLogo.trim(),
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Nome da organização</Label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ex.: Loopin TV"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL do logo</Label>
                  <Input
                    type="url"
                    value={orgLogo}
                    onChange={(e) => setOrgLogo(e.target.value)}
                    placeholder="https://..."
                  />
                  {orgLogo && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                      <img
                        src={orgLogo}
                        alt="Logo preview"
                        className="h-12 w-12 rounded object-contain"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                      <span className="text-xs text-muted-foreground">Pré-visualização</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={upsertSettings.isPending}>
                    Salvar organização
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APIs */}
        <TabsContent value="apis">
          <Card>
            <CardHeader>
              <CardTitle>Integração com OpenWeather</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Necessária para o widget de Clima funcionar.{" "}
                <a
                  href="https://openweathermap.org/api"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Obter chave grátis
                </a>
                .
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  upsertSettings.mutate({ api_weather_key: weatherKey.trim() });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Chave da API</Label>
                  <Input
                    value={weatherKey}
                    onChange={(e) => setWeatherKey(e.target.value)}
                    placeholder="Cole aqui sua chave"
                    className="font-mono text-xs"
                  />
                </div>
                {weatherTest && (
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      weatherTest.ok
                        ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300"
                        : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300",
                    )}
                  >
                    {weatherTest.msg}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={testWeather} disabled={testing}>
                    {testing ? "Testando…" : "Testar conexão"}
                  </Button>
                  <Button type="submit" disabled={upsertSettings.isPending}>
                    Salvar chave
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Alterar senha</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newPw.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres");
                  if (newPw !== confirmPw) return toast.error("As senhas não coincidem");
                  changePassword.mutate(newPw);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPw && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full transition-all", strength.color)}
                          style={{ width: strength.w }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Força: <span className="font-medium">{strength.label}</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Confirme a senha</Label>
                  <Input
                    type={showPw ? "text" : "password"}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={changePassword.isPending}>
                    Alterar senha
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPEARANCE */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Sua preferência é salva neste navegador.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {themes.map((t) => {
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={cn(
                        "group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all",
                        active
                          ? "border-primary bg-primary/5 shadow-soft ring-2 ring-primary/30"
                          : "hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                        )}
                      >
                        <t.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold">{t.label}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACCOUNT */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sua conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand text-lg font-semibold text-primary-foreground">
                  {(user?.email ?? "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user?.email?.split("@")[0]}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-muted-foreground">ID do usuário</p>
                  <code className="mt-1 block break-all font-mono text-[11px] text-foreground">
                    {user?.id}
                  </code>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-muted-foreground">Conta criada em</p>
                  <p className="mt-1 font-medium text-foreground">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" /> Zona de perigo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium">Limpar cache local</p>
                  <p className="text-xs text-muted-foreground">
                    Remove dados salvos neste navegador e recarrega.
                  </p>
                </div>
                <Button variant="outline" onClick={clearCache}>
                  <Trash className="mr-2 h-4 w-4" /> Limpar
                </Button>
              </div>
              <div className="flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium">Sair da conta</p>
                  <p className="text-xs text-muted-foreground">
                    Encerra sua sessão neste dispositivo.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
