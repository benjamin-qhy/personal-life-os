import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, join, resolve, relative, basename } from "node:path";
import { exists, filesIn, put, pathKey } from "./files";
import { writeManifest, createArchive, verifyArchive } from "./archive";
import { compilePlugin } from "./build-obsidian";
const defaults = resolve(import.meta.dir, "../../scripts/template/defaults");
const userFolders = [
  "01 Journal/",
  "02 Retreats/",
  "04 Projects/",
  "05 People/",
  "06 Writing/",
  "07 Library/",
  "09 Reading/Chapters/",
  "09 Reading/Verses/",
  "09 Reading/Study Notes/",
  "09 Reading/Topics/",
];
const boards: Record<string, string> = {
  "04 Projects/Projects Board.md": "Projects Board",
  "06 Writing/Newsletters/Newsletter Board.md": "Newsletter Board",
  "06 Writing/YouTube Scripts/YouTube Board.md": "YouTube Board",
  "06 Writing/Articles/Article Board.md": "Article Board",
  "06 Writing/Course Content/Course Board.md": "Course Board",
};
const dropRoots = new Set([
  ".git",
  ".github",
  ".claude",
  ".vault-meta",
  ".raw",
  ".trash",
  "node_modules",
  "src",
  "tests",
  "dist",
  "build",
]);
export function dropped(rel: string): boolean {
  rel = rel.normalize("NFC").toLowerCase();
  const parts = rel.split("/"),
    name = parts.at(-1)!;
  if (
    parts.some(
      (p) =>
        dropRoots.has(p.toLowerCase()) ||
        p.toLowerCase() === "__pycache__" ||
        /^\.env/i.test(p),
    )
  )
    return true;
  if (
    /^(?:package(?:-lock)?\.json|bun\.lockb?|tsconfig.*\.json|\.mcp\.json|\.claude-obsidian\.json|\.directory|\.ds_store|thumbs\.db|auth\.json|credentials.*|\.npmrc|\.netrc|\.pypirc|id_rsa|id_ed25519)$/i.test(
      name,
    )
  )
    return true;
  if (
    /(?:\.canvas|\.pyc|\.png\.bak|\.html|\.log)$/.test(name) ||
    name.startsWith("untitled")
  )
    return true;
  if (
    rel.startsWith("docs/") &&
    ![
      "docs/agents",
      "docs/agents/domain.md",
      "docs/agents/issue-tracker.md",
      "docs/agents/triage-labels.md",
    ].includes(rel)
  )
    return true;
  if (rel.startsWith("scripts/"))
    return ![
      "scripts/generate_reading_plan.ts",
      "scripts/split_bible.ts",
      "scripts/release.md",
    ].includes(rel);
  if (
    ["guide/18 distribution checklist.md", ".obsidian/graph.json"].includes(
      rel,
    ) ||
    /^\.obsidian\/workspace.*\.json$/.test(rel)
  )
    return true;
  if (
    /^(?:meta\/agent chats|agent client)(?:\/|$)/.test(rel) ||
    /^\.obsidian\/plugins\/agent-client\/sessions(?:\/|$)/.test(rel) ||
    /data\.json\.bak$/.test(rel)
  )
    return true;
  if (
    /^wiki\/(?:concepts|sources|entities|questions|log)(?:\/|$)/.test(rel) ||
    rel.startsWith("inbox/")
  )
    return true;
  if (rel.startsWith("meta/attachments/"))
    return name !== ".gitkeep" && !name.startsWith("cover.");
  return false;
}
function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            !/secret|token|password|api.?key|authorization|certificate|private.?key|^env$/i.test(
              k,
            ),
        )
        .map(([k, v]) => [k, clean(v)]),
    );
  if (
    typeof value === "string" &&
    /BEGIN (?:RSA |PRIVATE |CERTIFICATE)|\b(?:sk-|ghp_|xoxb-)[A-Za-z0-9_-]{8,}|Bearer\s+\S{16,}/.test(
      value,
    )
  )
    throw new Error("Sensitive value detected in allowlisted settings");
  return value;
}
export async function safePluginSettings(plugin: string, source: string) {
  const fixed: Record<string, unknown> = {
    "obsidian-local-rest-api": { enableInsecureServer: true },
    "agent-client": {
      savedSessions: [],
      autoAllowPermissions: false,
      customAgents: [],
      presetAgents: {},
      autoMentionActiveNote: false,
      expandWikilinkContext: false,
    },
    seo: { scanDirectories: "06 Writing", checkExternalLinks: false },
    omnisearch: { httpApiEnabled: false, DANGER_httpHost: null },
    "life-os-app": {},
  };
  if (plugin in fixed) return fixed[plugin];
  const allowed: Record<string, string[]> = {
    dataview: [
      "enableDataviewJs",
      "enableInlineDataviewJs",
      "enableInlineDataview",
      "refreshEnabled",
      "refreshInterval",
    ],
    "templater-obsidian": [
      "data_version",
      "templates_folder",
      "trigger_on_file_creation_mode",
      "trigger_on_file_creation",
      "folder_templates",
      "enabled_templates_hotkeys",
      "syntax_highlighting",
      "syntax_highlighting_mobile",
    ],
    "periodic-notes": [
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
      "hasMigratedDailyNoteSettings",
      "hasMigratedWeeklyNoteSettings",
    ],
    quickadd: ["choices", "templateFolderPaths", "migrations", "version"],
    "obsidian-tasks-plugin": [
      "globalQuery",
      "globalFilter",
      "removeGlobalFilter",
      "taskFormat",
      "setCreatedDate",
      "setDoneDate",
      "setCancelledDate",
      "recurrenceOnNextLine",
    ],
    "obsidian-kanban": [
      "kanban-plugin",
      "show-checkboxes",
      "lane-width",
      "date-format",
      "time-format",
    ],
  };
  if (!allowed[plugin]) return undefined;
  const original = JSON.parse(await readFile(source, "utf8"));
  if (!original || Array.isArray(original) || typeof original !== "object")
    throw new Error("Unsupported plugin settings");
  const result = clean(
    Object.fromEntries(
      allowed[plugin]!.filter((k) => k in original).map((k) => [
        k,
        original[k],
      ]),
    ),
  );
  if (plugin === "quickadd")
    Object.assign(result, {
      disableOnlineFeatures: true,
      ai: { providers: [] },
      globalVariables: {},
    });
  return result;
}
export async function copyTree(live: string, out: string) {
  await mkdir(out, { recursive: true });
  const seen = new Set<string>();
  const defaultKeys = new Set((await filesIn(defaults)).map(pathKey));
  async function visit(rel: string) {
    for (const item of await readdir(join(live, rel), {
      withFileTypes: true,
    })) {
      const path = rel ? `${rel}/${item.name}` : item.name;
      if (dropped(path)) continue;
      const canonicalRoots = [
        ".obsidian",
        "Meta",
        "03 Planning",
        "08 Tasks",
        "wiki",
        ...userFolders.map((p) => p.split("/")[0]!),
      ];
      const root = path.split("/")[0]!;
      if (
        canonicalRoots.some(
          (p) => p.toLowerCase() === root.toLowerCase() && p !== root,
        )
      )
        throw new Error("Noncanonical protected folder");
      const key = pathKey(path);
      if (seen.has(key)) throw new Error("Conflicting package paths");
      seen.add(key);
      if (item.isSymbolicLink() || (!item.isFile() && !item.isDirectory()))
        throw new Error("Package source contains non-regular file");
      if (item.isDirectory()) {
        await visit(path);
        continue;
      }
      const source = join(live, path),
        target = join(out, path);
      if (
        defaultKeys.has(pathKey(path)) ||
        /^(?:03 Planning|08 Tasks|wiki)\//.test(path)
      )
        continue;
      if (
        path.startsWith(".obsidian/") &&
        !path.startsWith(".obsidian/plugins/")
      ) {
        const name = path.slice(10);
        let settings: any;
        if (name === "app.json") settings = { newFileLocation: "current" };
        else if (
          ["appearance.json", "types.json", "webviewer.json"].includes(name)
        )
          settings = {};
        else if (
          [
            "core-plugins.json",
            "community-plugins.json",
            "hotkeys.json",
          ].includes(name)
        ) {
          const original = JSON.parse(await readFile(source, "utf8"));
          if (name === "community-plugins.json") {
            if (
              !Array.isArray(original) ||
              original.some(
                (x) => typeof x !== "string" || !/^[a-z0-9-]+$/.test(x),
              )
            )
              throw new Error("Unsupported plugin inventory");
            settings = original;
          } else {
            if (
              !original ||
              Array.isArray(original) ||
              typeof original !== "object"
            )
              throw new Error("Unsupported settings");
            settings = Object.fromEntries(
              Object.entries(original).filter(([k, v]) =>
                name === "hotkeys.json"
                  ? k.startsWith("life-os-app:")
                  : typeof v === "boolean",
              ),
            );
            if (name === "core-plugins.json") settings.sync = false;
            settings = clean(settings);
          }
        }
        if (settings !== undefined)
          await put(target, JSON.stringify(settings, null, 2) + "\n");
        continue;
      }
      if (path in boards) {
        await put(
          target,
          `---\nkanban-plugin: board\n---\n\n# ${boards[path]}\n\n## Ideas\n\n## In progress\n\n## Done\n`,
        );
        continue;
      }
      if (path.startsWith(".obsidian/plugins/")) {
        if (path.split("/").length !== 4) continue;
        // First-party runtime assets come from maintained source, never the live installation.
        if (path.startsWith(".obsidian/plugins/life-os-app/") && item.name !== "data.json") continue;
        if (item.name === "data.json") {
          const settings = await safePluginSettings(
            path.split("/")[2]!,
            source,
          );
          if (settings !== undefined)
            await put(target, JSON.stringify(settings, null, 2) + "\n");
          continue;
        }
        if (
          !["main.js", "manifest.json", "styles.css", "LICENSE"].includes(
            item.name,
          )
        )
          continue;
      }
      if (userFolders.some((p) => pathKey(path).startsWith(pathKey(p)))) {
        if (!path.endsWith(".md")) continue;
        const head = (await readFile(source, "utf8")).slice(0, 4000);
        const front = /^---\n([\s\S]*?)\n---/.exec(head);
        if (!front || !/^\s*-\s*example\s*$/m.test(front[1]!)) continue;
      }
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }
  await visit("");
}
export async function validateDestination(
  live: string,
  outputRoot: string,
  name: string,
) {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  )
    throw new Error("Build name must be one plain directory name");
  const parent = resolve(outputRoot);
  for (let p = parent; ; p = dirname(p)) {
    if ((await exists(p)) && (await lstat(p)).isSymbolicLink())
      throw new Error("Output paths must not contain symbolic links");
    if (dirname(p) === p) break;
  }
  const source = await realpath(live);
  const within = (a: string, b: string) => {
    const rel = relative(a, b);
    return !rel || (!rel.startsWith("..") && !rel.startsWith("/"));
  };
  if (within(source, parent) || within(parent, source))
    throw new Error("Output root must be outside live vault and ancestors");
  const destination = join(parent, name);
  if (await exists(destination)) throw new Error("Destination already exists");
  return { source, parent, destination };
}
async function resetDefaults(out: string) {
  for (const rel of [
    "Meta/Compass Config.md",
    "03 Planning/Life Theme.md",
    "03 Planning/Core Values.md",
    "03 Planning/Ideal Week.md",
    "08 Tasks/Tasks.md",
  ]) {
    const s = await lstat(join(defaults, rel));
    if (!s.isFile() || s.isSymbolicLink())
      throw new Error("Clean defaults missing or unsafe");
  }
  for (const rel of await filesIn(defaults)) {
    await mkdir(dirname(join(out, rel)), { recursive: true });
    await copyFile(join(defaults, rel), join(out, rel));
  }
}
async function textSurgery(out: string, withoutReading: boolean) {
  async function edit(rel: string, fn: (s: string) => string) {
    const p = join(out, rel);
    if (await exists(p)) await put(p, fn(await readFile(p, "utf8")));
  }
  await edit("Guide/Source - Video Analysis.md", (s) =>
    s.replace(
      /\n## Transcript[\s\S]*/,
      "\n## Transcript\nNot included in the distributed template. Watch the video at the source URL above.\n",
    ),
  );
  if (!withoutReading) return;
  for (const rel of [
    "09 Reading",
    "Guide/07 Workflow - Daily Reading.md",
    "scripts/generate_reading_plan.ts",
    "scripts/split_bible.ts",
    "Templates/Study Note.md",
  ])
    await rm(join(out, rel), { recursive: true, force: true });
  await edit("Templates/Daily Note.md", (s) =>
    s
      .replace(/> \[!reading\]- Daily reading\n(?:> .*\n)+\n/g, "")
      .replaceAll("path does not include 09 Reading/Reading Plan\n", ""),
  );
  await edit("00 Dashboards/Setup.md", (s) =>
    s.replace(
      " Decide the reading module: fill [[Reading Plan]] or delete `09 Reading`.",
      "",
    ),
  );
  await edit("Guide/00 Start Here.md", (s) =>
    s.replace(/^\| 5 \| Daily reading.*\n/gm, ""),
  );
  await edit("AGENTS.md", (s) => s.replace(/^\| `09 Reading\/`.*\n/gm, ""));
  await edit("README.md", (s) => s.replace(/^09 Reading\/.*\n/gm, ""));
  await edit("00 Dashboards/Task Dashboard.md", (s) =>
    s.replaceAll("path does not include 09 Reading/Reading Plan\n", ""),
  );
  await edit(".obsidian/plugins/templater-obsidian/data.json", (s) => {
    const d = JSON.parse(s);
    d.folder_templates = (d.folder_templates ?? []).filter(
      (x: any) => !String(x.folder ?? "").startsWith("09 Reading"),
    );
    return JSON.stringify(d, null, 2) + "\n";
  });
}
export class BuildVerificationError extends Error {
  constructor(public readonly checks: string[]) {
    super("候选版本验证失败");
  }
}
export interface BuildOptions {
  live: string;
  out: string;
  name?: string | undefined;
  version: string;
  zip?: boolean | undefined;
  withoutReading?: boolean | undefined;
}
export async function buildTemplate(options: BuildOptions) {
  const { version } = options,
    name = options.name ?? "Personal-Life-OS";
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))
    throw new Error("Version must be explicit semantic version");
  const { source, parent, destination } = await validateDestination(
    options.live,
    options.out,
    name,
  );
  const archive = join(
    parent,
    `${name}-template-v${version}${options.withoutReading ? "-without-reading" : ""}.zip`,
  );
  if (
    options.zip &&
    ((await exists(archive)) || (await exists(archive + ".sha256")))
  )
    throw new Error("Archive or checksum already exists");
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, ".life-os-stage-"));
  await chmod(staging, 0o700);
  const candidate = join(staging, name);
  let owned = false,
    archived = false;
  try {
    await mkdir(candidate, { mode: 0o700 });
    await copyTree(source, candidate);
    await resetDefaults(candidate);
    for (const artifact of await compilePlugin()) {
      await put(join(candidate, ".obsidian/plugins/life-os-app", artifact.name), artifact.content);
    }
    await put(
      join(candidate, ".obsidian/plugins/obsidian-local-rest-api/data.json"),
      JSON.stringify({ enableInsecureServer: true }, null, 2) + "\n",
    );
    const workspace = {
      main: {
        id: "main",
        type: "split",
        children: [
          {
            id: "leaf",
            type: "tabs",
            children: [
              {
                id: "setup",
                type: "leaf",
                state: {
                  type: "markdown",
                  state: { file: "00 Dashboards/Setup.md", mode: "preview" },
                },
              },
            ],
          },
        ],
        direction: "vertical",
      },
      active: "setup",
      lastOpenFiles: ["00 Dashboards/Setup.md"],
    };
    await put(
      join(candidate, ".obsidian/workspace.json"),
      JSON.stringify(workspace, null, 2) + "\n",
    );
    await textSurgery(candidate, !!options.withoutReading);
    const plugins: string[] = [];
    for (const rel of await filesIn(candidate))
      if (/^\.obsidian\/plugins\/[^/]+\/manifest.json$/.test(rel)) {
        const data = JSON.parse(await readFile(join(candidate, rel), "utf8"));
        plugins.push(
          `  ${JSON.stringify(rel.split("/")[2])}: ${JSON.stringify(String(data.version))}\n`,
        );
      }
    await put(
      join(candidate, "Meta/version.md"),
      `---\ntemplate_version: ${version}\nbuilt: ${new Date().toISOString().slice(0, 10)}\nrelease_status: candidate\nmin_obsidian: 1.13.1\nplugins:\n${plugins.join("")}---\n# 版本\n\n这是本地候选版本，尚不代表完成原生应用验收或发布。本系统不提供原地更新。请先备份旧知识库，再将内容和自定义配置迁移到独立的新副本，并逐项检查冲突。参见 \`scripts/RELEASE.md\`。\n`,
    );
    await put(join(candidate, "inbox/.gitkeep"), "");
    await put(join(candidate, "Meta/attachments/.gitkeep"), "");
    for (const rel of await filesIn(candidate))
      await chmod(join(candidate, rel), 0o644);
    await writeManifest(candidate);
    const { verifyTemplate } = await import("./verify-template");
    const checks = await verifyTemplate(candidate);
    if (checks.some((c) => !c.ok))
      throw new BuildVerificationError(
        checks.filter((c) => !c.ok).map((c) => c.check),
      );
    await mkdir(destination, { mode: 0o700 });
    owned = true;
    await rename(candidate, destination);
    if (options.zip) {
      await createArchive(destination, archive);
      archived = true;
      await verifyArchive(archive);
    }
    return { destination, archive: options.zip ? archive : undefined };
  } catch (error) {
    if (owned) await rm(destination, { recursive: true, force: true });
    if (archived) {
      await rm(archive, { force: true });
      await rm(archive + ".sha256", { force: true });
    }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
