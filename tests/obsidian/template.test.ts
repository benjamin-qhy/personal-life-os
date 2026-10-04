import { expect, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("模板构建命令打包生成的插件并通过恢复验证", async () => {
  const out = await realpath(await mkdtemp(join(tmpdir(), "life-os-plugin-package-")));
  try {
    const child = Bun.spawn([process.execPath, resolve("scripts/build_template.ts"),
      "--out", out, "--name", "Candidate", "--version", "1.1.0", "--zip"], { stdout: "pipe", stderr: "pipe" });
    const stdout = new Response(child.stdout).text();
    const stderr = new Response(child.stderr).text();
    const code = await child.exited;
    const output = (await stdout) + (await stderr);
    expect({ code, failure: code ? output : "" }).toEqual({ code: 0, failure: "" });
    const manifest = JSON.parse(await readFile(join(out, "Candidate/.obsidian/plugins/life-os-app/manifest.json"), "utf8"));
    expect(manifest.name).toBe("Personal Life OS");
    const restore = Bun.spawn([process.execPath, resolve("scripts/verify_archive_restore.ts"),
      join(out, "Candidate-template-v1.1.0.zip")], { stdout: "pipe", stderr: "pipe" });
    const restored = new Response(restore.stdout).text();
    const errors = new Response(restore.stderr).text();
    expect(await restore.exited).toBe(0);
    await Promise.all([restored, errors]);
  } finally { await rm(out, { recursive: true, force: true }); }
}, 60_000);
