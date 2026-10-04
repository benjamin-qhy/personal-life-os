import { expect, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm, access, appendFile } from "node:fs/promises";
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
    // A candidate cannot replace a first-party capture script, even with a new manifest.
    const qaPath = join(out, "Candidate/.obsidian/plugins/quickadd/data.json");
    const qaOriginal = await readFile(qaPath, "utf8");
    const qa = JSON.parse(qaOriginal);
    const journal = qa.choices.find((choice: { id: string }) => choice.id === "lifeos-journal");
    journal.captureTo += "\nthrow new Error('untrusted candidate script must not execute');";
    const { writeFile } = await import("node:fs/promises");
    await writeFile(qaPath, JSON.stringify(qa));
    const { verifyTemplate } = await import("../../src/tooling/verify-template");
    const altered = await verifyTemplate(join(out, "Candidate"));
    expect(altered.find(result => result.check === "配置结构完整有效")?.ok).toBe(false);
    const retargeted = JSON.parse(qaOriginal);
    const retargetedJournal = retargeted.choices.find((choice: { id: string }) => choice.id === "lifeos-journal");
    const { compileQuickAddCapture } = await import("../../src/tooling/build-vault-assets");
    const replacement = await compileQuickAddCapture("lifeos-journal", "01 Journal/Daily/{{DATE:YYYY-MM-DD}}.md", ["无关章节"]);
    retargetedJournal.captureTo = replacement.captureTo;
    retargetedJournal.insertAfter.after = replacement.after;
    await writeFile(qaPath, JSON.stringify(retargeted));
    const redirected = await verifyTemplate(join(out, "Candidate"));
    expect(redirected.find(result => result.check === "配置结构完整有效")?.ok).toBe(false);
    await writeFile(qaPath, qaOriginal);
    // A regenerated manifest must not bless a changed dependency runtime.
    await appendFile(join(out, "Candidate/scripts/ai-runtime/pi-acp.js"), "\n// unexpected modification\n");
    const { writeManifest } = await import("../../src/tooling/archive");
    await writeManifest(join(out, "Candidate"));
    const verify = Bun.spawn([process.execPath, resolve("scripts/verify_template.ts"), join(out, "Candidate"), "--json"], { stdout: "pipe", stderr: "pipe" });
    const checks = new Response(verify.stdout).json() as Promise<Array<{ check: string; ok: boolean }>>;
    const verificationErrors = new Response(verify.stderr).text();
    expect(await verify.exited).toBe(1);
    expect((await checks).find(result => result.check === "Pi 运行文件及许可证与当前源码构建一致")?.ok).toBe(false);
    await verificationErrors;
  } finally { await rm(out, { recursive: true, force: true }); }
}, 60_000);

test("不含阅读模块的候选仍可完整构建和恢复，且不保留研读入口", async () => {
  const out = await realpath(await mkdtemp(join(tmpdir(), "life-os-no-reading-")));
  try {
    const child = Bun.spawn([process.execPath, resolve("scripts/build_template.ts"), "--out", out, "--name", "Lite", "--version", "1.1.0", "--zip", "--without-reading"], { stdout: "pipe", stderr: "pipe" });
    const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const code = await child.exited;
    expect({ code, failure: code ? (await output).join("") : "" }).toEqual({ code: 0, failure: "" });
    await output;
    const root = join(out, "Lite");
    await expect(access(join(root, "09 Reading"))).rejects.toThrow();
    const choices = JSON.parse(await readFile(join(root, ".obsidian/plugins/quickadd/data.json"), "utf8")).choices;
    expect(choices.some((choice: { id: string }) => choice.id === "lifeos-new-study-note")).toBe(false);
    expect(await readFile(join(root, "Templates/Daily Note.md"), "utf8")).not.toContain("[!reading]");
    const restore = Bun.spawn([process.execPath, resolve("scripts/verify_archive_restore.ts"), join(out, "Lite-template-v1.1.0-without-reading.zip")], { stdout: "ignore", stderr: "pipe" });
    const errors = new Response(restore.stderr).text();
    expect(await restore.exited).toBe(0);
    await errors;
  } finally { await rm(out, { recursive: true, force: true }); }
}, 60_000);
