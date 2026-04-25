import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const CORE_VERSION = "0.12.6";
const CORE_BASES = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`,
];

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function loadFromBase(base: string): Promise<FFmpeg> {
  const ff = new FFmpeg();
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  ]);
  await ff.load({ coreURL, wasmURL });
  return ff;
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let lastErr: unknown = null;
    for (const base of CORE_BASES) {
      try {
        const ff = await loadFromBase(base);
        ffmpegInstance = ff;
        return ff;
      } catch (err) {
        console.warn(`[ffmpeg] falha ao carregar de ${base}:`, err);
        lastErr = err;
      }
    }
    loadingPromise = null;
    throw new Error(
      `Não foi possível carregar o ffmpeg-core: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    );
  })();

  return loadingPromise;
}

export type TranscodeProgress = (info: {
  phase: "loading" | "transcoding" | "finalizing";
  progress: number;
}) => void;

export async function transcodeVideoFor720p(
  file: File,
  onProgress?: TranscodeProgress,
): Promise<File> {
  onProgress?.({ phase: "loading", progress: 0 });
  const ff = await getFFmpeg();

  const inputName = "input" + (file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4");
  const outputName = "output.mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    const p = Math.max(0, Math.min(1, progress));
    onProgress?.({ phase: "transcoding", progress: p });
  };
  ff.on("progress", progressHandler);

  try {
    await ff.writeFile(inputName, await fetchFile(file));

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
    const buf = new Uint8Array(raw.byteLength);
    buf.set(raw);

    try { await ff.deleteFile(inputName); } catch { /* ignore */ }
    try { await ff.deleteFile(outputName); } catch { /* ignore */ }

    const outName = file.name.replace(/\.[^.]+$/, "") + "-720p.mp4";
    return new File([buf], outName, { type: "video/mp4" });
  } finally {
    ff.off("progress", progressHandler);
  }
}