import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workspace = fileURLToPath(new URL("../../", import.meta.url));

test("library typecheck regenerates stale declarations despite an up-to-date build cache", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "lenexus-typecheck-"));
  try {
    const packageJson = JSON.parse(await readFile(path.join(workspace, "package.json"), "utf8"));
    await writeFile(path.join(fixture, "package.json"), JSON.stringify({
      private: true,
      scripts: { "typecheck:libs": packageJson.scripts["typecheck:libs"] },
    }));
    await cp(path.join(workspace, "tsconfig.base.json"), path.join(fixture, "tsconfig.base.json"));
    await writeFile(path.join(fixture, "tsconfig.json"), JSON.stringify({
      files: [], references: [{ path: "lib/api-zod" }],
    }));
    const library = path.join(fixture, "lib/api-zod");
    await mkdir(library, { recursive: true });
    await cp(path.join(workspace, "lib/api-zod/src"), path.join(library, "src"), { recursive: true });
    await cp(path.join(workspace, "lib/api-zod/tsconfig.json"), path.join(library, "tsconfig.json"));
    await symlink(path.join(workspace, "node_modules"), path.join(fixture, "node_modules"));
    await symlink(path.join(workspace, "lib/api-zod/node_modules"), path.join(library, "node_modules"));

    function typecheck() {
      const result = spawnSync("pnpm", ["run", "typecheck:libs"], { cwd: fixture, encoding: "utf8" });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    typecheck();
    const declaration = path.join(library, "dist/generated/api.d.ts");
    const expected = await readFile(declaration, "utf8");
    assert.match(expected, /ZodEnum<\["official", "mod"\]>/);
    // Simulate a declaration imported from another dependency version, while
    // keeping the source and the incremental build cache unchanged.
    await writeFile(declaration, expected.replace(
      /ZodEnum<\["official", "mod"\]>/g,
      'ZodEnum<{ official: "official"; mod: "mod" }>',
    ));
    assert.notEqual(await readFile(declaration, "utf8"), expected);
    typecheck();
    assert.equal(await readFile(declaration, "utf8"), expected);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
