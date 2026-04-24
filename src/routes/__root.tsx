import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { ThemeProvider, useTheme } from "../lib/theme";
import { AuthProvider } from "../lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Loopin TV — Painel" },
      { name: "description", content: "Plataforma de TV corporativa Loopin TV" },
      { property: "og:title", content: "Loopin TV — Painel" },
      { name: "twitter:title", content: "Loopin TV — Painel" },
      { property: "og:description", content: "Plataforma de TV corporativa Loopin TV" },
      { name: "twitter:description", content: "Plataforma de TV corporativa Loopin TV" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7ef933a2-f1f1-4d7e-adb5-ebac7c46ec46/id-preview-b917a02c--010bddb0-c799-4215-9e2f-c415eea49153.lovable.app-1776787915538.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7ef933a2-f1f1-4d7e-adb5-ebac7c46ec46/id-preview-b917a02c--010bddb0-c799-4215-9e2f-c415eea49153.lovable.app-1776787915538.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ToasterWithTheme() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} richColors position="top-right" closeButton />;
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <ToasterWithTheme />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
