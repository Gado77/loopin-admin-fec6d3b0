import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const assetsDir = path.join(distDir, "assets");

if (!fs.existsSync(distDir) || !fs.existsSync(assetsDir)) {
  throw new Error("dist/assets não encontrado após o build");
}

const assetFiles = fs.readdirSync(assetsDir);
const mainScript = assetFiles.find((file) => /^index-.*\.js$/.test(file));
const mainStyle = assetFiles.find((file) => /^styles-.*\.css$/.test(file));

if (!mainScript) {
  throw new Error("Bundle principal não encontrado em dist/assets");
}

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Loopin TV</title>
    ${mainStyle ? `<link rel="stylesheet" href="/assets/${mainStyle}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${mainScript}"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(distDir, "index.html"), html, "utf8");
console.log("dist/index.html gerado com sucesso");
