import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const dir=await mkdtemp(path.join(tmpdir(),"arki-dino-postgres-"));
const outfile=path.join(dir,"check.mjs");
const key=`isolated-dino-test:${randomUUID()}`;
try {
  await build({entryPoints:["tests/dino-postgres.ts"],outfile,bundle:true,platform:"node",format:"esm",
    banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'}});
  for(const phase of ["write","read-clean"]) {
    const result=spawnSync(process.execPath,[outfile,phase,key],{stdio:"inherit",env:{...process.env,ARKI_DINO_TEST_SQLITE:"0"}});
    if(result.status!==0) {process.exitCode=result.status||1;break;}
  }
} finally {await rm(dir,{recursive:true,force:true});}