import { createClient } from "@supabase/supabase-js";

// Mesma instância do projeto Loopin TV existente
const SUPABASE_URL = "https://sxsmirhqbslmvyesikgg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4c21pcmhxYnNsbXZ5ZXNpa2dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NjMwOTYsImV4cCI6MjA3OTQzOTA5Nn0.ZLk6DAEfAZ2D451pGw1DO1h4oDIaZZgrgLOV6QUArB8";

export const CLOUDFLARE_WORKER_URL =
  "https://loopin-media-worker.loopintv.workers.dev";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export async function uploadToWorker(file: File): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await fetch(`${CLOUDFLARE_WORKER_URL}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      Authorization: `Bearer ${session.access_token}`,
      "X-File-Name": file.name,
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Falha no upload");
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
