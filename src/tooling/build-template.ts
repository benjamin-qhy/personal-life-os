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
import { compileVaultArtifacts, compileQuickAddCapture, quickAddCaptureDefaults } from "./build-vault-assets";
import { compilePiRuntime } from "./build-pi-runtime";
import { runtimeLicenses } from "./runtime-licenses";
import { patchAgentClient } from "./patch-agent-client";
import { localizeSettings } from "./localize-settings";
import chinesePaths from "../../scripts/template/chinese-paths.json";
const defaults = resolve(import.meta.dir, "../../scripts/template/defaults");
const userFolders = [
  "01 日记/",
  "02 静修/",
  "04 项目/",
  "05 人物/",
  "06 写作/",
  "07 书库/",
  "09 阅读/",
];
const boards: Record<string, string> = {
  "04 项目/项目看板.md": "项目看板",
  "06 写作/通讯/通讯看板.md": "通讯看板",
  "06 写作/视频脚本/视频看板.md": "视频看板",
  "06 写作/文章/文章看板.md": "文章看板",
  "06 写作/课程/课程看板.md": "课程看板",
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
  // Retired source folders must not become unclassified files and bypass the
  // private-note filters after the canonical layout changes to Chinese.
  if (chinesePaths.directories.some(row => !row.from.includes("/") && parts[0] === row.from.toLowerCase())) return true;
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
      "scripts/reading-books.ts",
      "scripts/release.md",
    ].includes(rel);
  if (
    ["使用指南/18 distribution checklist.md", ".obsidian/graph.json"].includes(
      rel,
    ) ||
    /^\.obsidian\/workspace.*\.json$/.test(rel)
  )
    return true;
  if (
    /^(?:meta\/agent chats|系统\/(?:agent chats|聊天记录)|agent client)(?:\/|$)/.test(rel) ||
    /^\.obsidian\/plugins\/agent-client\/sessions(?:\/|$)/.test(rel) ||
    /data\.json\.bak$/.test(rel)
  )
    return true;
  if (
    /^wiki\/(?:concepts|sources|entities|questions|log)(?:\/|$)/.test(rel) ||
    rel.startsWith("inbox/")
  )
    return true;
  if (rel.startsWith("系统/附件/"))
    return name !== ".gitkeep" && !name.startsWith("封面.");
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
      autoAllowPermissions: false,
      customAgents: [{ id: "personal-life-os-pi", displayName: "Personal Life OS · Pi", command: "bun", args: ["run", "./scripts/ai-runtime/pi-acp.js"], enabled: true,
        env: [{ key: "LIFE_OS_AUTH", value: "codex" }, { key: "LIFE_OS_PROVIDER", value: "openai-codex" }, { key: "LIFE_OS_MODEL", value: "gpt-6.1-sol" }] }],
      presetAgents: {},
      defaultAgentId: "personal-life-os-pi",
      debugMode: false,
      exportSettings: { autoExportOnNewChat: false, autoExportOnCloseChat: false },
      autoMentionActiveNote: false,
      expandWikilinkContext: false,
    },
    seo: { scanDirectories: "06 写作", checkExternalLinks: false },
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
  const result = localizeSettings(clean(
    Object.fromEntries(
      allowed[plugin]!.filter((k) => k in original).map((k) => [
        k,
        original[k],
      ]),
    ),
  ));
  if (plugin === "quickadd")
    Object.assign(result, {
      disableOnlineFeatures: true,
      ai: { providers: [] },
      globalVariables: {},
    });
  if (plugin === "quickadd" && result && typeof result === "object" && "choices" in result && Array.isArray(result.choices)) {
    const labels: Record<string, string> = {
      "lifeos-journal": "📝 记录日记", "lifeos-win": "🏆 记录收获", "lifeos-gratitude": "🙏 记录感恩", "lifeos-task": "✅ 添加任务",
      "lifeos-newsletter-idea": "✉️ 记录通讯想法", "lifeos-video-idea": "🎬 记录视频想法", "lifeos-article-idea": "📰 记录文章想法", "lifeos-project-idea": "💡 记录项目想法",
      "lifeos-daily": "📅 打开今天日记", "lifeos-weekly": "🗓️ 打开本周笔记", "lifeos-quarterly": "🧭 打开本季度笔记", "lifeos-retreat": "🏕️ 创建本季度静修",
      "lifeos-new-project": "📁 新建项目", "lifeos-new-person": "👤 新建人物", "lifeos-new-newsletter": "✉️ 新建通讯", "lifeos-new-video": "🎬 新建视频脚本",
      "lifeos-new-article": "📰 新建文章", "lifeos-new-course-lesson": "🎓 新建课程", "lifeos-new-book": "📚 新建书籍笔记", "lifeos-new-study-note": "📖 新建研读笔记",
    };
    for (const choice of result.choices) {
      if (!choice || typeof choice !== "object") continue;
      if (typeof choice.id === "string" && labels[choice.id]) choice.name = labels[choice.id];
      const capture = quickAddCaptureDefaults[choice.id];
      if (choice.insertAfter && capture) {
        const compiled = await compileQuickAddCapture(choice.id, capture.target, capture.headings);
        choice.captureTo = compiled.captureTo;
        choice.insertAfter.after = compiled.after;
        choice.insertAfter.createIfNotFound = false;
      }
      if (choice.fileNameFormat && typeof choice.fileNameFormat.format === "string") choice.fileNameFormat.format = choice.fileNameFormat.format.replace(/label:[^|}]+/, "label:笔记名称");
    }
  }
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
        "系统",
        "03 规划",
        "08 任务",
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
        /^(?:03 规划|08 任务|wiki)\//.test(path)
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
            if (name === "hotkeys.json") {
              for (const [id, modifiers, key] of [
                ["quickadd:choice:lifeos-daily", ["Mod", "Shift"], "D"],
                ["quickadd:choice:lifeos-weekly", ["Mod", "Alt"], "W"],
                ["quickadd:choice:lifeos-quarterly", ["Mod", "Alt"], "Q"],
                ["quickadd:choice:lifeos-retreat", ["Mod", "Alt"], "R"],
                ["templater-obsidian:模板/每日问题评分.md", ["Mod", "Shift"], "Q"],
              ] as const) settings[id] = [{ modifiers, key }];
            }
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
          `---\nkanban-plugin: board\n---\n\n# ${boards[path]}\n\n## 想法\n\n## 进行中\n\n## 已完成\n`,
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
    "系统/系统配置.md",
    "03 规划/人生主题.md",
    "03 规划/核心价值观.md",
    "03 规划/理想一周.md",
    "08 任务/任务总表.md",
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
  await edit("使用指南/来源 - 视频分析.md", (s) =>
    s.replace(
      /\n## Transcript[\s\S]*/,
      "\n## Transcript\nNot included in the distributed template. Watch the video at the source URL above.\n",
    ),
  );
  if (!withoutReading) return;
  for (const rel of [
    "09 阅读",
    "使用指南/07 工作流 - 每日阅读.md",
    "scripts/generate_reading_plan.ts",
    "scripts/split_bible.ts",
    "scripts/reading-books.ts",
    "模板/研读笔记.md",
  ])
    await rm(join(out, rel), { recursive: true, force: true });
  await edit("模板/每日日记.md", (s) =>
    s
      .replace(/> \[!reading\]-[^\n]*\n[\s\S]*?> ```\n\n/, "")
      .replaceAll("path does not include 09 阅读/阅读计划\n", ""),
  );
  await edit("00 仪表盘/开始使用.md", (s) =>
    s.replace(
      /按需选择阅读模块；[^\n]*/g,
      "本版本不含阅读模块。书籍笔记仍可正常使用。",
    ),
  );
  await edit("使用指南/00 从这里开始.md", (s) =>
    s.replace(/^\| 每日阅读[^\n]*\n/gm, ""),
  );
  await edit("AGENTS.md", (s) => s.replace(/^\| `09 阅读\/`.*\n/gm, ""));
  await edit("README.md", (s) => s
    .replace(/^\| `09 阅读\/`[^\n]*\n/gm, "")
    .replace(/^\| 可选每日阅读[^\n]*\n/gm, "")
    .replace("## 七个工作流", "## 六个工作流（本版本不含阅读模块）"));
  await edit("00 仪表盘/任务仪表盘.md", (s) =>
    s.replaceAll("path does not include 09 阅读/阅读计划\n", ""),
  );
  await edit(".obsidian/plugins/templater-obsidian/data.json", (s) => {
    const d = JSON.parse(s);
    d.folder_templates = (d.folder_templates ?? []).filter(
      (x: any) => !String(x.folder ?? "").startsWith("09 阅读"),
    );
    return JSON.stringify(d, null, 2) + "\n";
  });
  await edit(".obsidian/plugins/quickadd/data.json", (s) => {
    const data = JSON.parse(s);
    data.choices = (data.choices ?? []).filter((choice: { id?: string }) => choice.id !== "lifeos-new-study-note");
    return JSON.stringify(data, null, 2) + "\n";
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
    for (const artifact of await compileVaultArtifacts()) {
      await put(join(candidate, artifact.path), artifact.content);
    }
    const clientFolder = join(candidate, ".obsidian/plugins/agent-client");
    const originalClient = await readFile(join(clientFolder, "main.js"), "utf8");
    const patchedClient = await patchAgentClient(originalClient);
    await put(join(clientFolder, "upstream-main.js"), originalClient);
    await put(join(clientFolder, "main.js"), patchedClient.code);
    await put(join(clientFolder, "LIFE_OS_CACHE_PATCH_NOTICE.txt"), patchedClient.notice);
    await put(join(clientFolder, "LIFE_OS_CACHE_PATCH.json"), JSON.stringify({
      patchVersion: 1, upstreamVersion: "0.12.1",
      upstreamSha256: patchedClient.upstreamSha256, patchedSha256: patchedClient.patchedSha256,
    }, null, 2) + "\n");
    const runtime = await compilePiRuntime();
    await put(join(candidate, "scripts/ai-runtime/pi-acp.js"), runtime);
    await put(join(candidate, "scripts/ai-runtime/THIRD_PARTY_LICENSES.txt"), await runtimeLicenses(runtime));
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
                  state: { file: "00 仪表盘/开始使用.md", mode: "preview" },
                },
              },
            ],
          },
        ],
        direction: "vertical",
      },
      active: "setup",
      lastOpenFiles: ["00 仪表盘/开始使用.md"],
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
      join(candidate, "系统/版本.md"),
      `---\ntemplate_version: ${version}\nbuilt: ${new Date().toISOString().slice(0, 10)}\nrelease_status: candidate\nmin_obsidian: 1.13.1\nplugins:\n${plugins.join("")}---\n# 版本\n\n这是本地候选版本，尚不代表完成原生应用验收或发布。本系统不提供原地更新。请先备份旧知识库，再将内容和自定义配置迁移到独立的新副本，并逐项检查冲突。参见 \`scripts/RELEASE.md\`。\n`,
    );
    await put(join(candidate, "inbox/.gitkeep"), "");
    await put(join(candidate, "系统/附件/.gitkeep"), "");
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
