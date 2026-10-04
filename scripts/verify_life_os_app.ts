#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import moment from "moment";

const root = path.resolve(process.argv[2] || ".");
const pluginDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, ".obsidian/plugins/life-os-app");
const mainPath = path.join(pluginDir, "main.js");
const cssPath = path.join(pluginDir, "styles.css");
const manifestPath = path.join(pluginDir, "manifest.json");
const communityPath = path.join(root, ".obsidian/community-plugins.json");
const quickAddPath = path.join(root, ".obsidian/plugins/quickadd/data.json");
const noticesPath = path.join(root, "THIRD_PARTY_NOTICES.md");
const setupViewPath = process.argv[3] ? path.resolve(pluginDir, "../../vault/系统/views/setup.js") : path.join(root, "系统/views/setup.js");
const hotkeysPath = path.join(root, ".obsidian/hotkeys.json");

// The VM loads an untyped Obsidian plugin. Dynamic values are confined to this
// synthetic host boundary; no real vault note contents enter the runtime fixture.
type HostValue = any;
interface ElementOptions { cls?: string; text?: unknown; attr?: Record<string, unknown> }
interface Manifest { id: string; isDesktopOnly: boolean; version: string }
interface QuickAddChoice {
  id: string;
  type?: string;
  command?: boolean;
  templatePath?: string;
  folder?: { folders?: string[] };
  fileNameFormat?: { format?: string };
  fileExistsMode?: string;
}
interface QuickAddConfiguration { choices?: QuickAddChoice[] }
interface CheckResult { name: string; ok: boolean; detail: string }
const results: CheckResult[] = [];
const check = (name: string, condition: unknown, detail = "") => {
  results.push({ name, ok: Boolean(condition), detail });
};
const read = (file: string) => fs.readFileSync(file, "utf8");
const readJson = <T>(file: string): T => JSON.parse(read(file)) as T;

for (const file of [mainPath, cssPath, manifestPath, communityPath, quickAddPath, noticesPath, setupViewPath, hotkeysPath]) {
  check(`present: ${path.relative(root, file)}`, fs.existsSync(file));
}

if (results.some((result) => !result.ok)) {
  finish();
}

const source = read(mainPath);
const css = read(cssPath);
const manifest = readJson<Manifest>(manifestPath);
const community = readJson<string[]>(communityPath);
const quickAdd = readJson<QuickAddConfiguration>(quickAddPath);
const notices = read(noticesPath);
const setupView = read(setupViewPath);
const hotkeys = readJson<Record<string, unknown>>(hotkeysPath);

check("manifest id", manifest.id === "life-os-app", String(manifest.id));
check("manifest is mobile-capable", manifest.isDesktopOnly === false);
check("plugin enabled", community.includes("life-os-app"));
check(
  "notice version matches manifest",
  notices.includes(`| life-os-app | ${manifest.version} |`),
  manifest.version
);
check(
  "Setup verifies the Life OS application",
  setupView.includes('["life-os-app", "Personal Life OS"]') &&
    setupView.includes('findCommand("life-os-app:open-home")')
);
check(
  "canonical Projects folder restored",
  fs.existsSync(path.join(root, "04 项目/项目看板.md")) &&
    !fs.existsSync(path.join(root, "05 人物/04 项目/项目看板.md"))
);
check(
  "primary Life OS hotkeys configured",
  Array.isArray(hotkeys["life-os-app:open-home"]) &&
    Array.isArray(hotkeys["life-os-app:open-capture"])
);

try {
  new vm.Script(source, { filename: mainPath });
  check("JavaScript parses", true);
} catch (error) {
  check("JavaScript parses", false, error instanceof Error ? error.message : String(error));
}

const configuredCommands = new Set(
  (quickAdd.choices || []).map((choice) => `quickadd:choice:${choice.id}`)
);
const referencedCommands = new Set(
  [...source.matchAll(/quickadd:choice:[a-z0-9-]+/g)].map((match) => match[0])
);
const readingEnabled = fs.existsSync(path.join(root, "09 阅读/阅读计划.md"));
const missingCommands = [...referencedCommands].filter(
  (command) => !configuredCommands.has(command) && (readingEnabled || command !== "quickadd:choice:lifeos-new-study-note")
);
const quickAddById = new Map<string, QuickAddChoice>(
  (quickAdd.choices || []).map((choice) => [choice.id, choice])
);
const recordChoiceContracts: [string, string, string][] = [
  ["lifeos-new-project", "模板/项目.md", "04 项目"],
  ["lifeos-new-person", "模板/人物.md", "05 人物"],
  ["lifeos-new-newsletter", "模板/通讯.md", "06 写作/通讯"],
  ["lifeos-new-video", "模板/视频脚本.md", "06 写作/视频脚本"],
  ["lifeos-new-article", "模板/文章.md", "06 写作/文章"],
  ["lifeos-new-course-lesson", "模板/课程.md", "06 写作/课程"],
  ["lifeos-new-book", "模板/读书笔记.md", "07 书库/读书笔记"],
  ["lifeos-new-study-note", "模板/研读笔记.md", "09 阅读/研读笔记"],
];
check("reading-disabled distribution omits study-note capture", readingEnabled || !quickAddById.has("lifeos-new-study-note"));
const retreatChoice = quickAddById.get("lifeos-retreat");
const retreatTitle = retreatChoice?.fileNameFormat?.format?.replace(/\{\{DATE:([^}]+)\}\}/g, (_token, format: string) => moment("2026-10-04").format(format));
const retreatPath = `${retreatChoice?.folder?.folders?.[0]}/${retreatTitle}.md`;
check("retreat creation resolves the Chinese quarter path", retreatChoice?.command === true && retreatPath === "02 静修/2026-Q4 个人静修.md", retreatPath);
if (retreatChoice?.templatePath && fs.existsSync(path.join(root, retreatChoice.templatePath))) {
  const template = read(path.join(root, retreatChoice.templatePath));
  const tp = { file: { title: retreatTitle }, date: { now: (format: string) => moment("2026-10-04").format(format) } };
  const app = { vault: { getFileByPath: () => null }, metadataCache: { getFileCache: () => null } };
  let output = "", last = 0;
  for (const match of template.matchAll(/<%(\*?)([\s\S]*?)(-?)%>/g)) {
    output += template.slice(last, match.index);
    const body = match[1] ? `let tR = ""; ${match[2]}; return tR;` : `return (${match[2]});`;
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    output += String(await new AsyncFunction("tp", "app", "moment", body)(tp, app, moment));
    last = match.index! + match[0].length;
  }
  output += template.slice(last);
  check("configured retreat template produces the quarter and Chinese workflow", output.includes("quarter: 2026-Q4") && output.includes("## 3. 人生之轮") && output.includes("系统/views/wheel"));
} else check("configured retreat template exists", false);

const creationHotkeys = [
  ["lifeos-daily", "模板/每日日记.md", "01 日记/每日", ["Mod", "Shift"], "D"],
  ["lifeos-weekly", "模板/每周笔记.md", "01 日记/每周", ["Mod", "Alt"], "W"],
  ["lifeos-quarterly", "模板/季度笔记.md", "01 日记/每季", ["Mod", "Alt"], "Q"],
  ["lifeos-retreat", "模板/个人静修.md", "02 静修", ["Mod", "Alt"], "R"],
] as const;
for (const [id, template, folder, modifiers, key] of creationHotkeys) {
  const choice = quickAddById.get(id);
  const keys = hotkeys[`quickadd:choice:${id}`] as {modifiers?: string[]; key?: string}[] | undefined;
  check(`period creation and shortcut: ${id}`, choice?.templatePath === template && choice.folder?.folders?.includes(folder) && choice.command === true && fs.existsSync(path.join(root, template)) &&
    keys?.some(binding => binding.key === key && binding.modifiers?.length === modifiers.length && modifiers.every(modifier => binding.modifiers?.includes(modifier))));
}
const questionHotkeys = hotkeys["templater-obsidian:模板/每日问题评分.md"] as {modifiers?: string[]; key?: string}[] | undefined;
check("daily question shortcut uses the Chinese template command", questionHotkeys?.some(binding => binding.key === "Q" && binding.modifiers?.length === 2 && ["Mod", "Shift"].every(modifier => binding.modifiers?.includes(modifier))));
const invalidRecordChoices = recordChoiceContracts.filter(
  ([id, templatePath, folder]) => {
    if (!readingEnabled && id === "lifeos-new-study-note") return false;
    const choice = quickAddById.get(id);
    return !(
      choice?.type === "Template" &&
      choice.command === true &&
      choice.templatePath === templatePath &&
      choice.folder?.folders?.includes(folder) &&
      choice.fileNameFormat?.format?.includes("{{VALUE:") &&
      choice.fileExistsMode === "Nothing"
    );
  }
);
check(
  "record creation input contracts",
  invalidRecordChoices.length === 0,
  invalidRecordChoices.map(([id]) => id).join(", ")
);
check(
  "QuickAdd commands resolve",
  missingCommands.length === 0,
  missingCommands.join(", ")
);

const referencedPaths = new Set(
  [...source.matchAll(/(?:path:\s*|openPath\()"([^"]+\.md)"/g)].map(
    (match) => match[1]!
  )
);
const missingPaths = [...referencedPaths].filter(
  (file) => !fs.existsSync(path.join(root, file)) && (readingEnabled || file !== "09 阅读/阅读计划.md")
);
check("dashboard paths resolve", missingPaths.length === 0, missingPaths.join(", "));

const classNames = new Set(
  [...source.matchAll(/life-os-[a-z0-9-]+/g)].map((match) => match[0])
);
const missingStyles = [...classNames].filter(
  (className) => !css.includes(`.${className}`)
);
check("application classes are styled", missingStyles.length === 0, missingStyles.join(", "));

const prohibitedCapabilities = [
  "fetch",
  "requestUrl",
  "XMLHttpRequest",
  "WebSocket",
  "child_process",
  "vault.create",
  "vault.modify",
  "vault.process",
  "vault.delete",
  "vault.trash",
  "adapter.write",
  "adapter.remove",
];
const capabilityHits = prohibitedCapabilities.filter((term) => source.includes(term));
check(
  "no network, process, or direct vault-write capability",
  capabilityHits.length === 0,
  capabilityHits.join(", ")
);

class FakeElement {
  tag: string;
  options: ElementOptions;
  children: FakeElement[];
  handlers: Record<string, () => void>;
  constructor(tag = "div", options: ElementOptions = {}) {
    this.tag = tag;
    this.options = options;
    this.children = [];
    this.handlers = {};
  }

  empty() {
    this.children = [];
  }

  addClass(name: string) { this.options.cls = `${this.options.cls || ""} ${name}`.trim(); }
  setAttribute(name: string, value: unknown) { this.options.attr = { ...this.options.attr, [name]: value }; }

  toHTML(): string {
    const escape = (value: unknown) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const attrs = { ...this.options.attr, ...(this.options.cls ? { class: this.options.cls } : {}) };
    return `<${this.tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${escape(value)}"`).join(" ")}>${escape(this.options.text || "")}${this.children.map((child) => child.toHTML()).join("")}</${this.tag}>`;
  }

  createDiv(options: ElementOptions = {}) {
    return this.createEl("div", options);
  }

  createSpan(options: ElementOptions = {}) {
    return this.createEl("span", options);
  }

  createEl(tag: string, options: ElementOptions = {}) {
    const child = new FakeElement(tag, options);
    this.children.push(child);
    return child;
  }

  addEventListener(name: string, handler: () => void) {
    this.handlers[name] = handler;
  }
}

class Component {
  children?: Set<HostValue>;
  // Child rendering is exercised in the real-browser fixture, not this DOM stub.
  addChild(child: HostValue) { (this.children ||= new Set()).add(child); }
  removeChild(child: HostValue) { this.children?.delete(child); }
  registerDomEvent(element: FakeElement, name: string, handler: () => void) {
    element.addEventListener(name, handler);
  }

  registerEvent(event: HostValue) {
    return event;
  }
}

class ItemView extends Component {
  leaf: HostValue;
  app: HostValue;
  contentEl: FakeElement;
  constructor(leaf: HostValue) {
    super();
    this.leaf = leaf;
    this.app = leaf.app;
    this.contentEl = new FakeElement();
  }
}

// Obsidian Modal is not a Component and does not provide registerDomEvent.
class Modal {
  static lastOpened: Modal | undefined;
  app: HostValue;
  contentEl: FakeElement;
  onOpen(): void {}
  onClose(): void {}
  constructor(app: HostValue) {
    this.app = app;
    this.contentEl = new FakeElement();
    Modal.lastOpened = this;
  }

  open() {
    this.onOpen();
  }

  close() {
    this.onClose();
  }
}

class Plugin extends Component {
  views?: Map<string, HostValue>;
  viewType?: string;
  viewFactory?: HostValue;
  ribbon?: { icon: string; name: string; callback: HostValue };
  commands?: HostValue[];
  registerView(type: string, factory: HostValue) {
    this.views = this.views || new Map();
    this.views.set(type, factory);
    this.viewType = type;
    this.viewFactory = factory;
  }

  addRibbonIcon(icon: string, name: string, callback: HostValue) {
    this.ribbon = { icon, name, callback };
  }

  addCommand(command: HostValue) {
    this.commands = this.commands || [];
    this.commands.push(command);
  }
}

class TFile {
  path: string;
  constructor(filePath = "") {
    this.path = filePath;
  }
}

class Notice {}

try {
  const moduleBox: { exports: HostValue } = { exports: {} };
  vm.runInNewContext(
    source,
    {
      module: moduleBox,
      exports: moduleBox.exports,
      require(id: string) {
        if (id !== "obsidian") {
          throw new Error(`Unexpected dependency: ${id}`);
        }
        return {
          ItemView,
          Component,
          Modal,
          Notice,
          Plugin,
          TFile,
          moment: () => {
            const date = new Date("2026-09-09T12:00:00Z");
            const api = {
              clone: () => {
                const cloned = new Date(date.getTime());
                return {
                  subtract(amount: number, unit: string) {
                    if (unit === "days") {
                      cloned.setUTCDate(cloned.getUTCDate() - amount);
                    }
                    return this;
                  },
                  format(format: string) {
                    if (format === "YYYY-MM-DD") {
                      return cloned.toISOString().slice(0, 10);
                    }
                    if (format === "ddd") {
                      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][cloned.getUTCDay()];
                    }
                    return "2026-09-09";
                  },
                };
              },
              format(format: string) {
                const values: Record<string, string> = {
                  "YYYY-MM-DD": "2026-09-09",
                  "gggg-[W]ww": "2026-W37",
                  "YYYY-[Q]Q": "2026-Q3",
                  "[Week] ww": "Week 37",
                  "D MMM": "9 Sep",
                };
                return values[format] || "2026-09-09";
              },
            };
            return api;
          },
          setIcon: () => {},
        };
      },
    },
    { filename: mainPath }
  );

  const fakeFiles = [
    new TFile("04 项目/Example.md"),
    new TFile("04 项目/Metadata Pending.md"),
    new TFile("05 人物/Person.md"),
    new TFile("06 写作/文章/Article.md"),
    new TFile("06 写作/文章/Sample.md"),
    new TFile("07 书库/Task Example.md"),
    new TFile("08 任务/任务总表.md"),
    new TFile("08 任务/Archive.md"),
  ];
  const metadata = new Map<string, Record<string, unknown>>([
    ["04 项目/Example.md", { type: "project", status: "active" }],
    ["05 人物/Person.md", { type: "person" }],
    ["06 写作/文章/Article.md", { type: "article" }],
    ["06 写作/文章/Sample.md", { type: "article", tags: ["example"] }],
    ["07 书库/Task Example.md", { type: "book" }],
    [
      "系统/系统配置.md",
      {
        questions: [{ key: "dq_goals", text: "Did I set clear goals?" }],
        habits: ["habit_journal"],
      },
    ],
    ["01 日记/每日/2026-09-09.md", { dq_goals: 8, habit_journal: true }],
    ["00 仪表盘/开始使用.md", { status: "open" }],
  ]);
  const taskItem = (task: string, line: number) => ({
    task,
    position: { start: { line } },
  });
  const listItems = new Map([
    [
      "04 项目/Example.md",
      [
        taskItem(" ", 0),
        taskItem("x", 4),
        taskItem("/", 5),
        taskItem("?", 6),
        taskItem("-", 7),
      ],
    ],
    ["05 人物/Person.md", [taskItem(" ", 0)]],
    ["06 写作/文章/Article.md", [taskItem(" ", 0)]],
    ["06 写作/文章/Sample.md", [taskItem(" ", 0)]],
    ["07 书库/Task Example.md", [taskItem(" ", 0)]],
    ["08 任务/任务总表.md", [taskItem(" ", 0)]],
    ["08 任务/Archive.md", [taskItem(" ", 0)]],
  ]);
  const fileContents = new Map([
    [
      "04 项目/Example.md",
      [
        "- [ ] Ship the Life OS slice 📅 2026-09-09 ⏫",
        "```tasks",
        "- [ ] Fenced sample must stay out",
        "```",
        "- [x] Finished task ✅ 2026-09-08",
        "- [/] Continue the data pass ⏳ 2026-09-09",
        "- [?] Unknown custom status",
        "- [-] Cancelled task ❌ 2026-09-08",
      ].join("\n"),
    ],
    ["05 人物/Person.md", "- [ ] Discuss a decision #discuss"],
    ["06 写作/文章/Article.md", "- [ ] Draft the article 🔺"],
    ["06 写作/文章/Sample.md", "- [ ] Demonstration task"],
    ["07 书库/Task Example.md", "- [ ] Out-of-scope library task"],
    ["08 任务/任务总表.md", "- [ ] Triage the inbox ➕ 2026-09-08"],
    ["08 任务/Archive.md", "- [ ] Out-of-scope task archive"],
  ]);
  const metadataUnavailable = new Set(["04 项目/Metadata Pending.md"]);
  const pluginInstances = new Map<string, HostValue>([
    ["agent-client", { settings: { defaultAgentId: "synthetic-agent", autoAllowPermissions: false } }],
    ["obsidian-local-rest-api", { settings: {} }],
  ]);
  const requestedPaths: string[] = [];
  const fakeLeaf: HostValue = {
    app: null,
    async setViewState(this: HostValue, state: HostValue) {
      this.state = state;
    },
    async openFile(this: HostValue, file: TFile) { this.openedFile = file; },
  };
  const fakeApp: HostValue = {
    commands: { executeCommandById: () => true },
    plugins: { getPlugin: (id: string) => pluginInstances.get(id) || null },
    metadataCache: {
      on: () => ({ off: () => {} }),
      getFileCache: (file: TFile) =>
        metadataUnavailable.has(file.path)
          ? null
          : {
              frontmatter: metadata.get(file.path) || {},
              listItems: listItems.get(file.path) || [],
            },
    },
    vault: {
      on: () => ({ off: () => {} }),
      getMarkdownFiles: () => fakeFiles,
      cachedRead: async (file: TFile) => {
        if (file.path.startsWith("05 人物/")) {
          throw new Error("simulated unreadable note");
        }
        return fileContents.get(file.path) || "";
      },
      getAbstractFileByPath: (filePath: string) => {
        requestedPaths.push(filePath);
        return filePath.endsWith(".md") ? new TFile(filePath) : null;
      },
    },
    workspace: {
      getLeavesOfType: () => [],
      getLeaf: () => fakeLeaf,
      onLayoutReady: (callback: () => void) => callback(),
      revealLeaf: async () => {},
      detachLeavesOfType: () => {},
    },
  };
  fakeLeaf.app = fakeApp;

  const LifeOSPlugin = moduleBox.exports;
  const plugin = new LifeOSPlugin();
  plugin.app = fakeApp;
  await plugin.onload();
  check("view registered", plugin.viewType === "life-os-home", plugin.viewType);
  check("Brain view registered", plugin.views.has("life-os-brain"));
  const commandIds = new Set((plugin.commands || []).map((command: HostValue) => command.id));
  const requiredCommandIds = [
    "open-home",
    "open-capture",
    "open-configuration",
    "open-brain",
    ...[
      "today",
      "plan",
      "focus",
      "review",
      "projects",
      "people",
      "create",
      "library",
      "ai",
    ].map((screen) => `open-${screen}`),
  ];
  const missingAppCommands = requiredCommandIds.filter((id) => !commandIds.has(id));
  check(
    "application commands registered",
    missingAppCommands.length === 0,
    missingAppCommands.join(", ")
  );
  check("commands expose Chinese names with stable IDs", plugin.commands.find((command: HostValue) => command.id === "open-home")?.name === "打开 Personal Life OS 首页" && plugin.commands.find((command: HostValue) => command.id === "open-capture")?.name === "打开 Personal Life OS 快速记录");
  check("ribbon registered", plugin.ribbon?.icon === "compass", plugin.ribbon?.icon);

  const view = plugin.viewFactory(fakeLeaf);
  await view.onOpen();
  const screens = [
    "home",
    "today",
    "plan",
    "focus",
    "review",
    "projects",
    "people",
    "create",
    "library",
    "ai",
  ];
  const emptyScreens: string[] = [];
  const requiredPanels: Record<string, string> = {
    today: "life-os-today-live",
    plan: "life-os-plan-live",
    focus: "life-os-collection-live",
    review: "life-os-review-live",
    projects: "life-os-collection-live",
    people: "life-os-collection-live",
    create: "life-os-pipeline-live",
    library: "life-os-collection-live",
    ai: "life-os-ai-live",
  };
  const renderedPanels = new Set();
  const taskFeedsWithRows = new Set();
  let homeHasSystemSummary = false;
  let homeHasSetupBanner = false;
  let todayHasPropertyValues = false;
  const treeHasClass = (element: FakeElement, className: string): boolean =>
    String(element.options?.cls || "")
      .split(/\s+/)
      .includes(className) ||
    element.children.some((child) => treeHasClass(child, className));
  const treeHasText = (element: FakeElement, value: string): boolean =>
    element.options?.text === value ||
    element.children.some((child) => treeHasText(child, value));
  for (const screen of screens) {
    view.activeScreen = screen;
    view.render();
    if (!view.contentEl.children.length) {
      emptyScreens.push(screen);
    }
    if (requiredPanels[screen] && treeHasClass(view.contentEl, requiredPanels[screen])) {
      renderedPanels.add(screen);
    }
    if (["today", "focus"].includes(screen) && treeHasClass(view.contentEl, "life-os-task-row")) {
      taskFeedsWithRows.add(screen);
    }
    if (screen === "home") {
      homeHasSystemSummary = treeHasClass(view.contentEl, "life-os-summary");
      homeHasSetupBanner = treeHasClass(view.contentEl, "life-os-setup-banner");
    }
    if (screen === "today") {
      todayHasPropertyValues =
        treeHasText(view.contentEl, "8/10") && treeHasText(view.contentEl, "已完成");
    }
  }
  check("all application screens render", emptyScreens.length === 0, emptyScreens.join(", "));
  const missingPanels = Object.keys(requiredPanels).filter(
    (screen) => !renderedPanels.has(screen)
  );
  check("native live panels render", missingPanels.length === 0, missingPanels.join(", "));
  check(
    "task feed renders indexed commitments",
    taskFeedsWithRows.size === 2,
    [...taskFeedsWithRows].join(", ")
  );
  check("Home avoids duplicate system summary", !homeHasSystemSummary);
  check("Home onboarding state renders", homeHasSetupBanner);
  check("Today renders configured property values", todayHasPropertyValues);
  metadata.set("00 仪表盘/开始使用.md", { status: "done" });
  view.activeScreen = "home";
  view.render();
  check(
    "completed onboarding banner hides",
    !treeHasClass(view.contentEl, "life-os-setup-banner")
  );
  metadata.set("00 仪表盘/开始使用.md", { status: "open" });
  check(
    "task index degrades per file",
    view.taskSnapshot?.tasks.length === 4 &&
      view.taskSnapshot?.state === "partial" &&
      view.taskSnapshot?.skipped === 2,
    JSON.stringify({
      tasks: view.taskSnapshot?.tasks.length,
      state: view.taskSnapshot?.state,
      skipped: view.taskSnapshot?.skipped,
    })
  );
  const indexedTaskTexts = new Set<string>(
    (view.taskSnapshot?.tasks || []).map((task: HostValue) => task.text)
  );
  check(
    "task index uses structural metadata and includes Writing",
    indexedTaskTexts.has("Ship the Life OS slice") &&
      indexedTaskTexts.has("Continue the data pass") &&
      indexedTaskTexts.has("Draft the article") &&
      indexedTaskTexts.has("Triage the inbox")
  );
  check(
    "task index excludes fences, closed tasks, and non-source files",
    !indexedTaskTexts.has("Fenced sample must stay out") &&
      !indexedTaskTexts.has("Finished task") &&
      !indexedTaskTexts.has("Cancelled task") &&
      !indexedTaskTexts.has("Out-of-scope library task") &&
      !indexedTaskTexts.has("Out-of-scope task archive")
  );
  check(
    "task index reports unknown statuses without guessing",
    view.taskSnapshot?.unresolvedStatuses === 1 &&
      !indexedTaskTexts.has("Unknown custom status"),
    String(view.taskSnapshot?.unresolvedStatuses)
  );
  check(
    "task index reports metadata coverage and sample exclusions",
    view.taskSnapshot?.missingMetadata === 1 &&
      view.taskSnapshot?.examplesExcluded === 1 &&
      view.taskSnapshot?.candidateFiles === 6,
    JSON.stringify({
      missingMetadata: view.taskSnapshot?.missingMetadata,
      examplesExcluded: view.taskSnapshot?.examplesExcluded,
      candidateFiles: view.taskSnapshot?.candidateFiles,
    })
  );
  view.activeScreen = "home";
  view.render();
  check(
    "task feed exposes partial index coverage",
    treeHasText(
      view.contentEl,
      "4 项待办, 1 项无法读取, 1 项元数据待加载, 1 项状态待解析, 已排除 1 项示例"
    )
  );
  check(
    "task display strips supported Tasks metadata",
    [...indexedTaskTexts].every(
      (text) => !/[📅⏳➕🔺⏫🔼🔽⏬]/u.test(text)
    )
  );

  view.activeScreen = "ai";
  view.render();
  check(
    "permission status reports observable policy without enforcement claim",
    treeHasText(view.contentEl, "逐次确认") &&
      treeHasText(view.contentEl, "客户端已关闭自动批准。此处仅报告设置，不能证明审批已强制执行。") &&
      !treeHasText(view.contentEl, "每次写入必须批准")
  );
  pluginInstances.get("agent-client").settings.autoAllowPermissions = true;
  view.render();
  check(
    "permission status warns when auto-allow is enabled",
    treeHasText(view.contentEl, "已开启自动批准") &&
      treeHasText(view.contentEl, "客户端可能自动批准请求。此处仅报告设置，不能证明审批已强制执行。")
  );
  delete pluginInstances.get("agent-client").settings.autoAllowPermissions;
  view.render();
  check(
    "permission status remains unknown when setting is unobservable",
    treeHasText(view.contentEl, "未知") &&
      treeHasText(view.contentEl, "无法读取权限设置，因此无法确认审批执行情况。")
  );
  pluginInstances.get("agent-client").settings.autoAllowPermissions = false;

  metadata.set("系统/系统配置.md", {
    questions: [{ key: "dq_goals", text: "Did I set clear goals?" }],
    habits: ["habit_journal", "habit_exercise", "habit_reading"],
  });
  metadata.set("01 日记/每日/2026-09-09.md", {
    dq_goals: true,
    habit_journal: false,
    habit_reading: "yes",
  });
  const strictToday = view.getTodayData();
  check(
    "Today rejects boolean effort scores",
    strictToday.questionRecorded === 0 &&
      strictToday.questions[0]?.state === "invalid" &&
      strictToday.questions[0]?.display === "数值无效"
  );
  check(
    "Today distinguishes unchecked, missing, and invalid habits",
    strictToday.habitRecorded === 1 &&
      strictToday.habitDone === 0 &&
      strictToday.habits.map((habit: HostValue) => habit.state).join(",") ===
        "unchecked,missing,invalid" &&
      strictToday.habits.map((habit: HostValue) => habit.display).join(",") ===
        "未勾选,未记录,数值无效"
  );
  const coverage = view.summarizeDailyProperties(
    {
      dq_one: 8,
      dq_two: "8",
      habit_one: false,
      habit_two: true,
      habit_three: "false",
    },
    ["dq_one", "dq_two"],
    ["habit_one", "habit_two", "habit_three"]
  );
  check(
    "daily property coverage counts recorded false separately from habits done",
    coverage.questionsRecorded === 1 &&
      coverage.habitsRecorded === 2 &&
      coverage.habitsDone === 1 &&
      coverage.recorded === 3,
    JSON.stringify(coverage)
  );
  metadata.set("系统/系统配置.md", {
    daily_folder: "/Custom/Daily/",
    weekly_folder: "Custom/Weekly/",
    quarterly_folder: "Custom/Quarterly",
    retreat_folder: "Custom/Retreats",
    projects_folder: "Custom/Projects/",
    questions: [{ key: "dq_goals", text: "Did I set clear goals?" }],
    habits: ["habit_journal"],
  });
  requestedPaths.length = 0;
  view.getTodayData();
  view.renderPlanLive(new FakeElement());
  view.renderReviewLive(new FakeElement());
  view.getSystemStats();
  await view.openPath("04 项目/项目看板.md");
  const configuredFolders = view.getConfiguredFolders();
  check(
    "configured folders normalize without leading or trailing slashes",
    JSON.stringify(configuredFolders) === JSON.stringify({
      daily: "Custom/Daily",
      weekly: "Custom/Weekly",
      quarterly: "Custom/Quarterly",
      retreats: "Custom/Retreats",
      projects: "Custom/Projects",
    }),
    JSON.stringify(configuredFolders)
  );
  check(
    "Today, Plan, Review, and system stats use configured period paths",
    [
      "Custom/Daily/2026-09-09.md",
      "Custom/Weekly/2026-W37.md",
      "Custom/Quarterly/2026-Q3.md",
      "Custom/Retreats/2026-Q3 个人静修.md",
      "Custom/Projects/项目看板.md",
    ].every((path) => requestedPaths.includes(path)),
    requestedPaths.filter((path) => path.startsWith("Custom/")).join(", ")
  );
  check(
    "domain records use the configured projects folder",
    view.isDomainRecord(new TFile("Custom/Projects/Project.md")) &&
      !view.isDomainRecord(new TFile("04 项目/Project.md"))
  );
  metadata.set("系统/系统配置.md", {
    questions: [{ key: "dq_goals", text: "Did I set clear goals?" }],
    habits: ["habit_journal"],
  });
  metadata.set("01 日记/每日/2026-09-09.md", {
    dq_goals: 8,
    habit_journal: true,
  });

  const editorCalls: [string, HostValue][] = [];
  const taskLeaf: HostValue = {
    view: {
      editor: {
        setCursor: (position: HostValue) => editorCalls.push(["cursor", position]),
        scrollIntoView: (range: HostValue) => editorCalls.push(["scroll", range]),
      },
    },
    async openFile(this: HostValue, file: TFile) { this.openedFile = file; },
  };
  const getLeaf = fakeApp.workspace.getLeaf;
  fakeApp.workspace.getLeaf = () => taskLeaf;
  await view.openPath("08 任务/任务总表.md", 7);
  fakeApp.workspace.getLeaf = getLeaf;
  check(
    "task navigation targets the indexed source line",
    taskLeaf.openedFile?.path === "08 任务/任务总表.md" &&
      editorCalls[0]?.[0] === "cursor" &&
      editorCalls[0]?.[1]?.line === 6
  );

  plugin.commands.find((command: HostValue) => command.id === "open-capture").callback();
  check(
    "capture modal renders three action groups",
    (Modal.lastOpened?.contentEl.children || []).filter((child) =>
      treeHasClass(child, "life-os-capture-section")
    ).length === 3
  );
  check("reading-enabled capture exposes study notes", treeHasText(Modal.lastOpened!.contentEl, "新建研读笔记"));
  const originalFindFile = fakeApp.vault.getAbstractFileByPath;
  fakeApp.vault.getAbstractFileByPath = (filePath: string) => filePath.startsWith("09 阅读/") ? null : originalFindFile(filePath);
  plugin.commands.find((command: HostValue) => command.id === "open-capture").callback();
  check("reading-disabled capture retains book notes and omits study notes", treeHasText(Modal.lastOpened!.contentEl, "新建读书笔记") && !treeHasText(Modal.lastOpened!.contentEl, "新建研读笔记"));
  await plugin.commands.find((command: HostValue) => command.id === "open-library").callback();
  view.activeScreen = "library";
  view.render();
  check("reading-disabled library keeps books without broken reading actions", treeHasText(view.contentEl, "新建读书笔记") && !treeHasText(view.contentEl, "新建研读笔记") && !treeHasText(view.contentEl, "阅读计划"));
  fakeApp.vault.getAbstractFileByPath = originalFindFile;
  view.render();
  check("reading-enabled library exposes study and plan actions", treeHasText(view.contentEl, "新建研读笔记") && treeHasText(view.contentEl, "阅读计划"));
  const captureCommands: string[] = [];
  const originalExecute = fakeApp.commands.executeCommandById;
  fakeApp.commands.executeCommandById = (id: string) => { captureCommands.push(id); return true; };
  const captureButtons = (element: FakeElement): FakeElement[] => [
    ...(element.tag === "button" ? [element] : []),
    ...element.children.flatMap(captureButtons),
  ];
  captureButtons(Modal.lastOpened!.contentEl)[0]!.handlers.click!();
  check("capture choice executes journal command and closes modal",
    captureCommands.length === 1 && captureCommands[0] === "quickadd:choice:lifeos-journal" &&
    Modal.lastOpened!.contentEl.children.length === 0);
  captureCommands.length = 0;
  view.activeScreen = "today";
  view.render();
  const questionButton = captureButtons(view.contentEl).find(button => treeHasText(button, "开始有引导的晚间回顾。"));
  questionButton?.handlers.click?.();
  const questionCommand = "templater-obsidian:模板/每日问题评分.md";
  const templater = readJson<{ enabled_templates_hotkeys?: string[] }>(path.join(root, ".obsidian/plugins/templater-obsidian/data.json"));
  check("daily question button executes an enabled Chinese Templater command",
    captureCommands.includes(questionCommand) && templater.enabled_templates_hotkeys?.includes("模板/每日问题评分.md") && fs.existsSync(path.join(root, "模板/每日问题评分.md")));
  fakeApp.commands.executeCommandById = originalExecute;
  fakeLeaf.view = view;
  fakeApp.workspace.getLeavesOfType = () => [fakeLeaf];
  await plugin.activateView("today");
  check("view activation state", fakeLeaf.state?.type === "life-os-home", fakeLeaf.state?.type);
  check("direct module activation", view.activeScreen === "today", view.activeScreen);

  fakeFiles.push(new TFile("01 日记/每日/2026-09-09.md"), new TFile("01 日记/每日/2026-09-08.md"));
  metadata.set("01 日记/每日/2026-09-08.md", { tags: ["example"], dq_goals: 2, habit_journal: false });
  const real = view.getAnalytics();
  check("analytics excludes sample scores and preserves missing days", real.average === 8 && real.scored === 1 && real.days.filter((day: HostValue) => day.score === null).length === 29);
  view.includeExamples = true;
  check("analytics sample inclusion is explicit", view.getAnalytics().average === 5);
  metadata.set("01 日记/每日/2026-09-08.md", { dq_goals: true, habit_journal: false });
  check("boolean question values are not numeric scores", view.getAnalytics().scored === 1);
  view.includeExamples = false;
  check("record counters exclude templates and build copies",
    !view.isDomainRecord(new TFile("模板/项目.md")) &&
    !view.isDomainRecord(new TFile("build/04 项目/Project.md")));
  view.activeScreen = "home";
  view.render();
  const findText = (element: FakeElement, text: string): FakeElement | undefined => element.options?.text === text ? element :
    element.children.map((child) => findText(child, text)).find(Boolean);
  check("Home keeps full analytics in Review", !findText(view.contentEl, "7 天") && !!findText(view.contentEl, "查看回顾"));
  view.activeScreen = "review";
  view.render();
  findText(view.contentEl, "7 天")!.handlers.click!();
  check("chart range control changes aggregation window", view.getAnalytics().days.length === 7);
  findText(view.contentEl, "包含示例")!.handlers.click!();
  check("sample control changes state", view.includeExamples === true);
  view.analyticsDays = 30;
  view.includeExamples = false;

  if (process.env.LIFE_OS_PREVIEW) {
    // Generated visual-test artifact uses synthetic fixtures only.
    for (let i = 0; i < 30; i += 1) {
      const date = new Date("2026-09-09T12:00:00Z"); date.setUTCDate(date.getUTCDate() - i);
      const filePath = `01 日记/每日/${date.toISOString().slice(0, 10)}.md`;
      if (!fakeFiles.some((file) => file.path === filePath)) fakeFiles.push(new TFile(filePath));
      metadata.set(filePath, { dq_goals: 4 + i % 7, habit_journal: i % 3 !== 0, habit_reading: i % 4 !== 0, habit_exercise: i % 2 === 0 });
    }
    fakeFiles.push(new TFile("02 静修/2026-Q3 个人静修.md"));
    metadata.set("02 静修/2026-Q3 个人静修.md", { wheel_health: 7, wheel_relationships: 8, wheel_growth: 6, wheel_career: 7, wheel_fun: 5, wheel_meaning: 8 });
    view.activeScreen = "home"; view.render();
    fs.writeFileSync(process.env.LIFE_OS_PREVIEW, `<!doctype html><html><head><meta charset="utf-8"><title>Life OS visual test, synthetic data</title><style>
      :root { --background-primary:#202020; --background-secondary:#292929; --text-normal:#ddd; --text-muted:#aaa; --text-faint:#888; --color-green:#7aa995; --color-red:#df7777; }
      body { margin:0; background:#202020; color:#ddd; font-family:Arial,sans-serif; } button { height:30px; border-radius:18px; white-space:nowrap; padding:4px 10px; } .fixture-pane { width:100%; }
      ${css}</style></head><body><div class="fixture-pane">${view.contentEl.toHTML()}</div></body></html>`);
  }
} catch (error) {
  check("runtime smoke", false, error instanceof Error ? error.stack || error.message : String(error));
}

finish();

function finish() {
  const failed = results.filter((result) => !result.ok);
  for (const result of failed) {
    console.error(`FAIL ${result.name}${result.detail ? ` (${result.detail})` : ""}`);
  }
  console.log(`应用行为验证：${results.length - failed.length} 通过，${failed.length} 失败`);
  process.exit(failed.length ? 1 : 0);
}
