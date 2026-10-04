interface CaptureParameters {
  app: {
    vault: { getFileByPath(path: string): { path: string } | null };
    metadataCache: { getFileCache(file: { path: string }): { headings?: Array<{ level: number; heading: string }> } | null };
  };
  quickAddApi: { format(text: string): Promise<string> };
  variables: Record<string, unknown>;
}
interface CaptureConfig { key: string; target: string; headings: string[] }

// QuickAdd binds inline scripts to its public script parameters. Preserve the
// resolved capture destination so midnight or active-note changes cannot redirect lookup.
async function captureTarget(host: CaptureParameters, config: CaptureConfig): Promise<string> {
  delete host.variables[config.key];
  const target = await host.quickAddApi.format(config.target);
  if (!target.endsWith(".md") || target.split("/").some(part => !part || part.startsWith(".")) || /[\\\x00-\x1f:{}]/.test(target)) {
    throw new Error("捕获目标必须是明确的笔记库内 Markdown 路径。");
  }
  host.variables[config.key] = target;
  return target;
}

async function captureHeading(host: CaptureParameters, config: CaptureConfig): Promise<string> {
  const target = host.variables[config.key];
  delete host.variables[config.key];
  if (typeof target !== "string") throw new Error("捕获目标尚未解析，请重新执行捕获命令。");
  const file = host.app.vault.getFileByPath(target);
  if (!file) throw new Error("捕获目标笔记不存在，请先创建并完成模板填充。");
  // A newly created/template-filled file may not have reached the metadata cache.
  // Poll only this file, with a fixed deadline; never read body text or scan the vault.
  for (let attempt = 0; attempt <= 30; attempt++) {
    const cache = host.app.metadataCache.getFileCache(file);
    const matches = (cache?.headings ?? []).filter(item => item.level === 2 && config.headings.includes(item.heading));
    if (matches.length > 1) throw new Error("捕获目标必须有唯一的中文或英文章节；存在重名章节，请先检查目标笔记。");
    if (matches.length === 1) return `## ${matches[0]!.heading}`;
    if (attempt === 30) throw new Error("捕获目标标题尚未就绪或缺少唯一的中文或英文章节，请等待模板填充并检查目标笔记后重试。");
    await new Promise<void>(resolve => setTimeout(resolve, 100));
  }
  throw new Error("捕获目标章节无法解析。");
}
