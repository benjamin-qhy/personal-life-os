import { test, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  readFile,
  realpath,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  copyTree,
  validateDestination,
  buildTemplate,
} from "../../src/tooling/build-template";
import { put, exists, filesIn } from "../../src/tooling/files";
let base: string, live: string, out: string;
beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), "life-os-build-test-")));
  live = join(base, "live");
  out = join(base, "out");
  await mkdir(live);
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});
test("unsafe names, overlaps, existing output and symlink ancestors are refused", async () => {
  for (const name of ["..", ".", "../escape", "/absolute", "nested/name", ""])
    await expect(validateDestination(live, out, name)).rejects.toThrow();
  for (const parent of [live, join(live, "build"), base])
    await expect(
      validateDestination(live, parent, "Candidate"),
    ).rejects.toThrow();
  await mkdir(join(out, "Candidate"), { recursive: true });
  await expect(validateDestination(live, out, "Candidate")).rejects.toThrow();
  await symlink(out, join(base, "link"));
  await expect(
    validateDestination(live, join(base, "link", "child"), "Candidate"),
  ).rejects.toThrow();
});
test("private defaults and unknown boards never staged; known boards regenerated", async () => {
  for (const rel of [
    "Meta/Compass Config.md",
    "03 Planning/Life Theme.md",
    "08 Tasks/Tasks.md",
    "04 Projects/Private Board.md",
    "04 Projects/Projects Board.md",
  ])
    await put(join(live, rel), "PRIVATE_SENTINEL");
  await copyTree(live, out);
  expect(await filesIn(out)).toEqual(["04 Projects/Projects Board.md"]);
  expect(
    await readFile(join(out, "04 Projects/Projects Board.md"), "utf8"),
  ).not.toContain("PRIVATE_SENTINEL");
});
test("plugin credentials, sessions and machine state never staged", async () => {
  for (const plugin of ["obsidian-local-rest-api", "agent-client", "quickadd"])
    await put(
      join(live, `.obsidian/plugins/${plugin}/data.json`),
      JSON.stringify({
        apiKey: "PRIVATE_SENTINEL",
        savedSessions: ["PRIVATE_SENTINEL"],
        choices: [],
        ai: { providers: [{ apiKey: "PRIVATE_SENTINEL" }] },
      }),
    );
  await copyTree(live, out);
  for (const rel of await filesIn(out))
    expect(await readFile(join(out, rel), "utf8")).not.toContain(
      "PRIVATE_SENTINEL",
    );
  const agent = JSON.parse(
    await readFile(
      join(out, ".obsidian/plugins/agent-client/data.json"),
      "utf8",
    ),
  );
  expect(agent.autoAllowPermissions).toBe(false);
  expect(agent.autoMentionActiveNote).toBe(false);
});
test("source symlinks rejected", async () => {
  await symlink(join(base, "missing"), join(live, "link.md"));
  await expect(copyTree(live, out)).rejects.toThrow();
});
test("only example notes retained; engineering and credential artifacts dropped", async () => {
  for (const rel of [
    "src/a.ts",
    "tests/a.ts",
    "docs/a.md",
    "node_modules/a.js",
    "dist/a.js",
    ".env.local",
    "nested/.env",
    "package.json",
    "bun.lock",
    "tsconfig.json",
    "01 Journal/Daily/private.md",
  ])
    await put(join(live, rel), "PRIVATE_SENTINEL");
  await put(
    join(live, "01 Journal/Daily/example.md"),
    "---\ntags:\n  - example\n---\nSeed",
  );
  await copyTree(live, out);
  expect(await filesIn(out)).toEqual(["01 Journal/Daily/example.md"]);
});
test("failed validation publishes nothing and removes staging", async () => {
  await expect(
    buildTemplate({
      live,
      out,
      name: "Candidate",
      version: "1.0.0",
      zip: true,
    }),
  ).rejects.toThrow();
  expect(await exists(join(out, "Candidate"))).toBe(false);
  if (await exists(out)) expect(await filesIn(out)).toEqual([]);
});

test("valid destination accepted and collisions refused", async () => {
  expect((await validateDestination(live, out, "Candidate")).destination).toBe(
    join(out, "Candidate"),
  );
  await put(join(live, "Guide/A.md"), "a");
  await put(join(live, "Guide/a.md"), "b");
  // Case-insensitive filesystems coalesce these names; test Unicode/case paths only where distinct.
  const names = await filesIn(live);
  if (names.length === 2) await expect(copyTree(live, out)).rejects.toThrow();
});
test("case variants cannot bypass settings sanitization", async () => {
  await put(join(live, ".OBSIDIAN/app.json"), "PRIVATE_SENTINEL");
  await expect(copyTree(live, out)).rejects.toThrow();
});
test("existing archive is preserved before staging", async () => {
  await put(join(out, "Candidate-template-v1.0.0.zip"), "existing");
  await expect(
    buildTemplate({
      live,
      out,
      name: "Candidate",
      version: "1.0.0",
      zip: true,
    }),
  ).rejects.toThrow();
  expect(
    await readFile(join(out, "Candidate-template-v1.0.0.zip"), "utf8"),
  ).toBe("existing");
});
test("allowlisted nested credentials removed and sensitive strings refused", async () => {
  await put(
    join(live, ".obsidian/plugins/quickadd/data.json"),
    JSON.stringify({
      choices: [
        {
          name: "Capture",
          env: { secret: "PRIVATE_SENTINEL" },
          apiKey: "PRIVATE_SENTINEL",
        },
      ],
    }),
  );
  await copyTree(live, out);
  expect(
    await readFile(join(out, ".obsidian/plugins/quickadd/data.json"), "utf8"),
  ).not.toContain("PRIVATE_SENTINEL");
  await put(
    join(live, ".obsidian/plugins/quickadd/data.json"),
    JSON.stringify({ choices: [{ name: "sk-123456789abcdef" }] }),
  );
  await expect(copyTree(live, out)).rejects.toThrow();
});
test("engineering docs allowlist retains only linked agent instructions", async () => {
  for (const rel of [
    "docs/agents/domain.md",
    "docs/agents/issue-tracker.md",
    "docs/agents/triage-labels.md",
    "docs/private.md",
    "docs/agents/private.md",
  ])
    await put(join(live, rel), "synthetic");
  await copyTree(live, out);
  expect(await filesIn(out)).toEqual([
    "docs/agents/domain.md",
    "docs/agents/issue-tracker.md",
    "docs/agents/triage-labels.md",
  ]);
});

test("reading directory case variants cannot stage private notes", async () => {
  for (const rel of ["09 Reading/chapters/private.md", "09 Reading/Study notes/private.md", "09 Reading/VERSES/private.md"]) {
    await put(join(live, rel), "SYNTHETIC_PRIVATE_SENTINEL");
  }
  await copyTree(live, out);
  expect(await filesIn(out)).toEqual([]);
});

test("builder retains argparse help without requiring version", async () => {
  const { resolve } = await import("node:path");
  const child = Bun.spawn([process.execPath, resolve("scripts/build_template.ts"), "--help"], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(child.stdout).text(); await new Response(child.stderr).text();
  expect(await child.exited).toBe(0);
  expect(output).toContain("--without-reading");
});
