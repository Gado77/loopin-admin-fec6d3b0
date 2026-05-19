import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

console.log("Iniciando build-dist...");

try {
  const candidates = [
    ".output/public",
    ".vercel/output/static",
  ];

  const resolvedCandidates = candidates.map(dir => ({
    relative: dir,
    absolute: path.resolve(dir),
    exists: fs.existsSync(path.resolve(dir))
  }));

  console.log("Candidatos analisados:", JSON.stringify(resolvedCandidates, null, 2));

  const sourceDir = candidates.find((dir) => fs.existsSync(path.resolve(dir)));

  if (!sourceDir) {
    throw new Error(
      `Nenhum diretório de saída encontrado. Procurados: ${candidates.join(", ")}`,
    );
  }

  const srcPath = path.resolve(sourceDir);
  const distDir = path.resolve("dist");
  
  console.log(`Limpando diretório de destino: ${distDir}`);
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  console.log(`Copiando conteúdo de ${srcPath} para ${distDir}...`);
  
  // Para garantir cópia limpa do conteúdo e não da pasta em si:
  copyRecursiveSync(srcPath, distDir);

  console.log(`Copiado com sucesso de ${sourceDir} para dist/`);
  
  console.log("Iniciando geração do index do dist...");
  execSync("node scripts/generate-dist-index.mjs", { stdio: "inherit" });
  console.log("build-dist finalizado com sucesso!");
} catch (error) {
  console.error("Erro fatal no build-dist:", error);
  process.exit(1);
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName),
                        path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}
