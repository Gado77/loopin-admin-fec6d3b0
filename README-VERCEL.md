# Deploy na Vercel

O projeto na Lovable usa o preset de **Cloudflare Workers** (via `@lovable.dev/vite-tanstack-config`). Pra rodar na Vercel, faça os ajustes abaixo **no seu PC**, depois de baixar o código.

## 1. Trocar o `vite.config.ts`

Substitua o conteúdo por:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ target: "vercel" }),
    viteReact(),
  ],
});
```

## 2. Remover dependências da Cloudflare

```bash
npm remove @cloudflare/vite-plugin @lovable.dev/vite-tanstack-config
```

E apague o arquivo `wrangler.jsonc`.

## 3. Variáveis de ambiente

No painel da Vercel (Project → Settings → Environment Variables), adicione as mesmas chaves que você usa hoje (Supabase URL, anon key, qualquer outra secret).

Hoje as credenciais do Supabase estão **hardcoded** em `src/lib/supabase.ts`. Recomendado migrar pra variáveis:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
```

E criar `.env.local`:
```
VITE_SUPABASE_URL=https://sxsmirhqbslmvyesikgg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 4. Deploy

```bash
npm install
npm run build      # testa o build local
npx vercel         # primeiro deploy (preview)
npx vercel --prod  # produção
```

Ou conecte o repo do GitHub direto na Vercel — ela detecta o `vercel.json` e builda sozinha a cada push.

## Resumo

| Item | Lovable (atual) | Vercel |
|---|---|---|
| Runtime | Cloudflare Workers | Node serverless |
| Build target | `cloudflare-module` | `vercel` |
| Config | `wrangler.jsonc` | `vercel.json` |
| Env vars | Secrets da Lovable | Vercel dashboard |
