import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon, Sun, Moon, Laptop, User2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/page-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — Loopin TV" }] }),
});

function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: "light" as const, label: "Claro", icon: Sun, hint: "Fundo branco" },
    { id: "dark" as const, label: "Escuro", icon: Moon, hint: "Reduz cansaço visual" },
    { id: "system" as const, label: "Sistema", icon: Laptop, hint: "Segue o S.O." },
  ];

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Personalize a aparência e veja informações da sua conta."
        icon={SettingsIcon}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Escolha como o painel deve ser exibido. Sua preferência é salva
              neste navegador.
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
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                      )}
                    >
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
                <p className="truncate text-sm font-medium">
                  {user?.email?.split("@")[0]}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <User2 className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">ID</span>
              </div>
              <code className="mt-1 block break-all font-mono text-[11px]">{user?.id}</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
