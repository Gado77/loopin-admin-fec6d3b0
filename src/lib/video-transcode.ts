import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// Carrega o core do FFmpeg.wasm (single-thread; mais compatível, sem precisar de COOP/COEP)
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  return loadingPromise;
}

export type TranscodeProgress = (info: {
  phase: "loading" | "transcoding" | "finalizing";
  progress: number; // 0..1
}) => void;

/**
 * Converte vídeo para MP4 H.264 720p, ~1.5 Mbps, otimizado para TV Box.
 * - Mantém aspect ratio (largura par garantida)
 * - Não faz upscale: vídeos abaixo de 720p mantêm a resolução original
 * - Áudio AAC 96k mono (suficiente para sinalização digital)
 * - +faststart para playback progressivo
 */
export async function transcodeVideoFor720p(
  file: File,
  onProgress?: TranscodeProgress,
): Promise<File> {
  onProgress?.({ phase: "loading", progress: 0 });
  const ff = await getFFmpeg();

  const inputName = "input" + (file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4");
  const outputName = "output.mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    // ffmpeg.wasm às vezes manda valores >1 ou negativos; clamp
    const p = Math.max(0, Math.min(1, progress));
    onProgress?.({ phase: "transcoding", progress: p });
  };
  ff.on("progress", progressHandler);

  try {
    await ff.writeFile(inputName, await fetchFile(file));

    // -vf scale: limita altura a 720, mantém AR, força largura par
    // CRF 26 + maxrate ~1.8M + bufsize 3.6M => média ~1.5Mbps com qualidade boa
    await ff.exec([
      "-i", inputName,
      "-vf", "scale='if(gt(ih,720),-2,iw)':'if(gt(ih,720),720,ih)'",
      "-c:v", "libx264",
      "-profile:v", "main",
      "-level", "4.0",
      "-preset", "ultrafast",
      "-crf", "26",
      "-maxrate", "1800k",
      "-bufsize", "3600k",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "96k",
      "-ac", "1",
      "-movflags", "+faststart",
      outputName,
    ]);

    onProgress?.({ phase: "finalizing", progress: 1 });

    const data = await ff.readFile(outputName);
    const raw = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    // Copia para um ArrayBuffer "puro" (evita SharedArrayBuffer no tipo do BlobPart)
    const buf = new Uint8Array(raw.byteLength);
    buf.set(raw);

    // limpa arquivos virtuais
    try { await ff.deleteFile(inputName); } catch { /* ignore */ }
    try { await ff.deleteFile(outputName); } catch { /* ignore */ }

    const outName = file.name.replace(/\.[^.]+$/, "") + "-720p.mp4";
    return new File([buf], outName, { type: "video/mp4" });
  } finally {
    ff.off("progress", progressHandler);
  }
}
