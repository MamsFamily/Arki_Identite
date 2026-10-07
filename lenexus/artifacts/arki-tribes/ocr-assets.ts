import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Host the engine and dictionaries ourselves: no third-party requests, and no
// photo is uploaded. Assets are packaged during build, not downloaded at runtime.
export function localOcrAssets(base: string): Plugin {
  const require = createRequire(import.meta.url);
  const root = (pkg: string) => path.dirname(require.resolve(`${pkg}/package.json`));
  const core = root("tesseract.js-core");
  const files = new Map<string, string>([
    ["ocr/worker.min.js", path.join(root("tesseract.js"), "dist/worker.min.js")],
    ...["eng", "fra"].map(lang => [
      `ocr/lang/${lang}.traineddata.gz`,
      path.join(root(`@tesseract.js-data/${lang}`), "4.0.0_best_int", `${lang}.traineddata.gz`),
    ] as [string, string]),
    ...readdirSync(core).filter(name => name.endsWith(".wasm") || name.endsWith(".wasm.js"))
      .map(name => [`ocr/core/${name}`, path.join(core, name)] as [string, string]),
  ]);
  return {
    name: "local-ocr-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const prefix = `${base.replace(/\/$/, "")}/`;
        const filename = files.get(url.startsWith(prefix) ? url.slice(prefix.length) : url.replace(/^\//, ""));
        if (!filename) return next();
        res.setHeader("Content-Type", filename.endsWith(".js") ? "application/javascript" :
          filename.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(readFileSync(filename));
      });
    },
    generateBundle() {
      for (const [fileName, file] of files) this.emitFile({ type: "asset", fileName, source: readFileSync(file) });
    },
  };
}