import { compilePlugin } from "../src/tooling/build-obsidian";
import { compileVaultArtifacts } from "../src/tooling/build-vault-assets";
import { mkdir, lstat, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// The CLI has no target override: it must never deploy into the current .obsidian.
const root = await realpath(resolve(import.meta.dir, ".."));
try {
  const artifacts = await compilePlugin();
  const vaultArtifacts = await compileVaultArtifacts();
  let folder = root;
  for (const part of ["dist", "obsidian", "life-os-app"]) {
    folder = join(folder, part);
    await mkdir(folder).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
    const stat = await lstat(folder);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("输出目录不能是符号链接。");
  }
  for (const artifact of artifacts) {
    const temporary = join(folder, `.${artifact.name}.${crypto.randomUUID()}.tmp`);
    try { await writeFile(temporary, artifact.content, { flag: "wx" }); await rename(temporary, join(folder, artifact.name)); }
    finally { await rm(temporary, { force: true }); }
  }
  for (const artifact of vaultArtifacts) {
    let target = root;
    const parts = ["dist", "vault", ...artifact.path.split("/")];
    const file = parts.pop()!;
    for (const part of parts) {
      target = join(target, part);
      await mkdir(target).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
      const stat = await lstat(target);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("输出目录不能是符号链接。");
    }
    const temporary = join(target, `.${file}.${crypto.randomUUID()}.tmp`);
    try { await writeFile(temporary, artifact.content, { flag: "wx" }); await rename(temporary, join(target, file)); }
    finally { await rm(temporary, { force: true }); }
  }
  console.log("第一方插件已生成到 dist/obsidian/life-os-app，模板和仪表盘已生成到 dist/vault。");
} catch { console.error("插件构建失败，请检查源码和 dist 输出目录。"); process.exitCode = 1; }
