import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync } from "node:fs";

const out = path.resolve(import.meta.dirname, "node_modules/.cache/tribes-test.mjs");
const guideOut = path.resolve(import.meta.dirname, "node_modules/.cache/guides-test.mjs");
mkdirSync(path.dirname(out), { recursive: true });
for (const [entry,outfile] of [["tests/tribes.test.ts",out],["tests/guides.test.ts",guideOut]]) {
  await build({
    entryPoints: [path.resolve(import.meta.dirname,entry)],
    outfile, bundle: true, platform: "node", format: "esm",
    external: ["pino", "pino-http"],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
}
const result = spawnSync(process.execPath, ["--test", ...process.argv.slice(2), out,guideOut], {
  stdio: "inherit",
  env: {
    ...process.env, NODE_ENV: "production", PUBLIC_ORIGIN: "http://127.0.0.1",
    // Never inherit a live PostgreSQL connection in the isolated test process.
    DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/isolated",
    SESSION_SECRET: "isolated-test-fixture-not-a-real-secret",
    DISCORD_TOKEN: "isolated-fixture", DISCORD_CLIENT_ID: "", DISCORD_CLIENT_SECRET: "",
    DISCORD_GUILD_ID: "1156256997403000874",
    SITE_OWNER_DISCORD_ID: "1200000000000000005",
    ARKI_DINO_TEST_SQLITE: "1",
    ARKI_MAP_TEST_SQLITE: "1",
  },
});
process.exit(result.status ?? 1);