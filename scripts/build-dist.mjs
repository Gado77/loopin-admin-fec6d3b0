import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const candidates = [
  ".output/public",
  ".vercel/output/static",
];

const sourceDir = candidates.find((dir) => fs.existsSync(path.resolve(dir)));

if (!sourceDir) {
  throw new Error(
    `Nenhum diretório de saída encontrado. Procurados: ${candidates.join(", ")}`,
  );
}

const distDir = path.resolve("dist");
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

execSync(`cp -R ${sourceDir}/. ${distDir}/`, { stdio: "inherit" });
console.log(`Copiado ${sourceDir} → dist/`);

execSync("node scripts/generate-dist-index.mjs", { stdio: "inherit" });
